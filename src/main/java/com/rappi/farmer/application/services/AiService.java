package com.rappi.farmer.application.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.presentation.api.AiController;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
public class AiService {

    private static final String GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions";
    /** Modelo rápido con límite de tokens/min 3x mayor que versatile. */
    private static final String MODEL         = "llama-3.1-8b-instant";
    private static final long   CACHE_SECONDS = 600; // 10 min

    private final String apiKey;
    private final RestTemplate restTemplate = new RestTemplate();

    // Caché simple para la recomendación diaria
    private record CachedRec(Map<String, Object> data, Instant expiresAt) {}
    private final AtomicReference<CachedRec> recCache = new AtomicReference<>();

    public AiService(@Value("${groq.api.key:}") String apiKey) {
        this.apiKey = apiKey;
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GROQ_API_KEY no configurada — funciones de IA desactivadas");
        }
    }

    // ── Mensaje de WhatsApp ───────────────────────────────────────────────────

    /**
     * Genera un mensaje de WhatsApp personalizado según el contexto real de la tienda.
     *
     * @param storeName   Nombre del restaurante
     * @param agingDays   Días desde el inicio del onboarding
     * @param agingStage  Etapa del ciclo (NEW, M1, M2, M2+…)
     * @param segment     Sección del dashboard (ONBOARDING, ALIADOS, CHURN, AVA, SELF)
     * @param churnLabel  Etiqueta de churn si aplica (Churn, Prevention W1/W2/W3)
     * @param avaLabel    Etiqueta AVA si aplica (Crítico, Bajando)
     * @param avaPct      Porcentaje AVA actual (0-100), null si no aplica
     * @param currentStatus Texto del campo "Estado Churn AVA" del Excel
     * @param baseTemplate  Plantilla base del farmer (puede estar vacía)
     */
    public String generateWhatsappMessage(String storeName, int agingDays, String agingStage,
                                          String segment, String churnLabel, String avaLabel,
                                          Double avaPct, String currentStatus, String baseTemplate) {

        String systemPrompt = buildSystemPrompt();
        String userPrompt   = buildUserPrompt(storeName, agingDays, agingStage, segment,
                churnLabel, avaLabel, avaPct, currentStatus, baseTemplate);

        return callGroq(systemPrompt, userPrompt, 0.75, 600);
    }

    private String buildSystemPrompt() {
        return """
                Eres el asistente de mensajería de un Account Manager (AM) de Rappi Colombia.
                Tu única función es redactar mensajes de WhatsApp para restaurantes aliados.

                REGLAS ABSOLUTAS:
                - Escribe en español colombiano informal pero respetuoso. Usa "hola", no "buen día".
                - Habla de TÚ al restaurante (nunca "usted", nunca "vos").
                - Máximo 500 caracteres — WhatsApp no es email.
                - NUNCA menciones que eres IA ni que el mensaje fue generado automáticamente.
                - NUNCA uses frases vacías como "espero que estés bien" o "un cordial saludo".
                - El mensaje debe tener UN solo llamado a la acción claro y concreto.
                - Usa máximo 1-2 emojis relevantes, no pongas emojis decorativos.
                - Firma siempre con: "– Equipo Rappi 🍕" al final.
                - Responde ÚNICAMENTE con el mensaje listo para enviar. Sin explicaciones ni comillas.
                """;
    }

    private String buildUserPrompt(String storeName, int agingDays, String agingStage,
                                   String segment, String churnLabel, String avaLabel,
                                   Double avaPct, String currentStatus, String baseTemplate) {
        StringBuilder sb = new StringBuilder();
        sb.append("Restaurante: ").append(storeName).append("\n");
        sb.append("Días en Rappi: ").append(agingDays).append("\n");
        if (agingStage != null && !agingStage.isBlank()) {
            sb.append("Etapa: ").append(agingStage).append("\n");
        }
        if (avaPct != null) {
            sb.append("Conexión AVA actual: ").append(String.format("%.0f", avaPct)).append("%\n");
        }
        if (currentStatus != null && !currentStatus.isBlank()) {
            sb.append("Estado en sistema: ").append(currentStatus).append("\n");
        }

        sb.append("\nOBJETIVO DEL MENSAJE: ");
        sb.append(buildObjective(segment, churnLabel, avaLabel, agingDays, avaPct));

        if (baseTemplate != null && !baseTemplate.isBlank()) {
            sb.append("\n\nTono de referencia (adapta libremente): ").append(baseTemplate);
        }

        sb.append("\n\nEscribe el mensaje para ").append(storeName).append(":");
        return sb.toString();
    }

    private String buildObjective(String segment, String churnLabel, String avaLabel,
                                  int agingDays, Double avaPct) {
        // Churn perdido → recuperación urgente
        if ("Churn".equals(churnLabel)) {
            return """
                    Recuperación urgente. El restaurante ha dejado de vender o conectarse.
                    Genera urgencia sin ser agresivo. Menciona que ves inactividad y ofrece ayuda concreta.
                    Pregunta si hay algún problema técnico o de operación. El tono es de alarma amigable.
                    """;
        }
        // Prevention W1 → primera alerta
        if ("Prevention W1".equals(churnLabel)) {
            return """
                    Prevención temprana de abandono (semana 1 de alerta).
                    El restaurante muestra señales de reducción de actividad.
                    Mensaje de check-in: pregunta cómo va la operación y si necesitan apoyo.
                    Tono: preocupación genuina, no alarmante.
                    """;
        }
        // Prevention W2/W3 → alerta escalada
        if ("Prevention W2".equals(churnLabel) || "Prevention W3".equals(churnLabel)) {
            return """
                    Prevención de abandono (semana 2-3 de alerta, situación crítica).
                    El restaurante lleva varias semanas con baja actividad.
                    Mensaje directo: ofrece llamada o visita esta semana, menciona que el equipo está pendiente.
                    Tono: directo, resolutivo, sin rodeos.
                    """;
        }
        // AVA crítico (< 30%)
        if ("Crítico".equals(avaLabel) || (avaPct != null && avaPct < 30)) {
            return String.format("""
                    AVA (conexión con Rappi Aliados) está en %.0f%% — muy por debajo del 60%% requerido.
                    Explica de forma simple que mientras más conectado esté el restaurante, más pedidos recibe.
                    Pide que revisen la app de Rappi Aliados y confirmen si hay algún problema.
                    Tono: educativo y de soporte técnico.
                    """, avaPct != null ? avaPct : 0.0);
        }
        // AVA bajando (30-60%)
        if ("Bajando".equals(avaLabel) || (avaPct != null && avaPct < 60)) {
            return String.format("""
                    AVA en %.0f%%, bajando del objetivo del 60%%.
                    Mensaje de seguimiento: recuerda que la conexión afecta directamente las ventas.
                    Pregunta si tienen la app activa y si necesitan ayuda con algún ajuste.
                    Tono: motivador y de seguimiento.
                    """, avaPct != null ? avaPct : 0.0);
        }
        // Onboarding días 1-3 → bienvenida y activación
        if (agingDays <= 3) {
            return """
                    Bienvenida en los primeros días. El restaurante acaba de unirse.
                    Mensaje cálido que confirma que ya están listos en Rappi y les dice el siguiente paso:
                    activar la app de Rappi Aliados y comenzar a recibir pedidos.
                    Tono: emocionante, motivador, de inicio.
                    """;
        }
        // Onboarding días 4-8 → seguimiento de activación
        if (agingDays <= 8) {
            return String.format("""
                    Seguimiento de onboarding (día %d). El restaurante lleva una semana en Rappi.
                    Mensaje para asegurarse que ya está activo y recibiendo pedidos.
                    Si aún no han recibido pedidos, ofrece revisar el menú y la visibilidad.
                    Tono: de acompañamiento, como un aliado que los está monitoreando.
                    """, agingDays);
        }
        // Aliados 8-14 → AVA check
        if (agingDays <= 14) {
            return """
                    Semana 2 en Rappi. Es el momento clave para revisar la conexión con Rappi Aliados.
                    Mensaje preguntando cómo va la operación y recordando la importancia de mantenerse conectado.
                    Menciona que el equipo está monitoreando y que pueden ayudar con cualquier ajuste.
                    Tono: de seguimiento profesional.
                    """;
        }
        // Default: seguimiento general
        return """
                Seguimiento general de una tienda activa.
                Mensaje breve de check-in para saber cómo va la operación y si necesitan algo.
                Tono: cercano, de Account Manager que está pendiente de su cartera.
                """;
    }

    // ── Recomendación diaria de cartera ──────────────────────────────────────

    /**
     * Lee la cartera del farmer y devuelve un mensaje motivacional + lista priorizada de tiendas
     * con justificación para cada una. Formato de respuesta: JSON con "message" y "priorities".
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> generateRecommendation(List<Store> stores) {
        // Devolver caché si está vigente
        CachedRec cached = recCache.get();
        if (cached != null && Instant.now().isBefore(cached.expiresAt())) {
            log.debug("Recomendación desde caché");
            return cached.data();
        }
        String context = buildStoreContext(stores, 20); // reducido de 40 a 20

        String systemPrompt = """
                Eres el asistente estratégico de un Account Manager (AM) de Rappi Colombia.
                Analizas la cartera de restaurantes y priorizas las acciones del día.
                Respondes SIEMPRE en JSON válido, sin texto adicional, sin markdown, sin comillas extra.
                """;

        String userPrompt = """
                Analiza esta cartera de restaurantes y devuelve un JSON con exactamente esta estructura:
                {
                  "message": "Mensaje motivacional y estratégico de 2-3 oraciones para el AM. Menciona cuántas tiendas necesitan atención urgente y por qué.",
                  "priorities": [
                    {
                      "storeCode": "PE...",
                      "storeName": "Nombre",
                      "priority": "ALTA|MEDIA|BAJA",
                      "reason": "Por qué es prioridad (1 frase corta)",
                      "action": "Acción concreta a tomar hoy (1 frase)"
                    }
                  ]
                }

                Reglas de priorización (en orden de urgencia):
                - ALTA: onboarding día 1-7 sin activación (HO=NO), día 8-14 sin HO o AVA<60%, AVA MTD < 10%, churn activo
                - MEDIA: AVA entre 10-30%, sin seguimiento FU30d=NO, aging 15-30d sin contacto
                - BAJA: tiendas estables, solo check-in

                Devuelve máximo 15 tiendas en "priorities", las más críticas primero.
                Cartera actual:
                """ + context;

        String raw = callGroq(systemPrompt, userPrompt, 0.4, 1800); // reducido de 4000 a 1800

        try {
            // Limpiar posible markdown code block
            String json = raw.trim();
            if (json.startsWith("```")) {
                json = json.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
            }
            Map<String, Object> result = new ObjectMapper().readValue(json, Map.class);
            recCache.set(new CachedRec(result, Instant.now().plusSeconds(CACHE_SECONDS)));
            return result;
        } catch (Exception e) {
            log.warn("No se pudo parsear JSON de IA, devolviendo raw: {}", e.getMessage());
            return Map.of("message", raw, "priorities", List.of());
        }
    }

    // ── Mini chat ─────────────────────────────────────────────────────────────

    /**
     * Chat conversacional sobre la cartera. Mantiene historial de la sesión.
     */
    public String chat(List<Store> stores, List<AiController.ChatMessage> history, String userMessage) {
        String context = buildStoreContext(stores, 15);

        String systemPrompt = """
                Eres el asistente estratégico de un Account Manager de Rappi Colombia.
                Tienes acceso a su cartera de restaurantes activa (se incluye abajo).

                FORMATO OBLIGATORIO:
                - Usa SIEMPRE markdown válido en tus respuestas.
                - Para listas de tiendas usa SIEMPRE tablas markdown con esta sintaxis exacta:
                  | Tienda | Código | Motivo | Acción |
                  |--------|--------|--------|--------|
                  | Nombre | PExxxxx | razón | acción |
                - Para listas simples usa viñetas con guión: - item
                - Para énfasis usa **negrita**
                - Sé directo y conciso. Máximo 400 palabras.
                - NUNCA respondas con texto plano sin formato cuando hay datos tabulares.

                Contexto de la cartera:
                """ + context;

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        if (history != null) {
            for (AiController.ChatMessage m : history) {
                messages.add(Map.of("role", m.role(), "content", m.content()));
            }
        }
        messages.add(Map.of("role", "user", "content", userMessage));

        return callGroqMessages(messages, 0.7, 1500);
    }

    /** Construye un resumen comprimido de la cartera para mandar a la IA. */
    private String buildStoreContext(List<Store> stores, int maxStores) {
        StringBuilder sb = new StringBuilder();
        sb.append("Total tiendas activas: ").append(stores.size()).append("\n\n");
        sb.append("Código | Nombre | Canal | Aging | HO | AVA% | Estado | FollowUp30d\n");
        sb.append("-------------------------------------------------------------------\n");

        stores.stream()
            .sorted((a, b) -> Integer.compare(urgencyScore(b), urgencyScore(a)))
            .limit(maxStores)
            .forEach(s -> {
                sb.append(s.getStoreCode()).append(" | ")
                  .append(s.getStoreName()).append(" | ")
                  .append(s.getChannel() != null ? s.getChannel() : "-").append(" | ")
                  .append(s.getAging() != null ? s.getAging() + "d" : "-").append(" | ")
                  .append(Boolean.TRUE.equals(s.getHadHandoff()) ? "SI" : "NO").append(" | ")
                  .append(s.getConnectionPercentage() != null
                      ? s.getConnectionPercentage().toPlainString() + "%" : "-").append(" | ")
                  .append(s.getCurrentStatus() != null ? s.getCurrentStatus() : "-").append(" | ")
                  .append(s.getFollowUpLast30d() != null ? s.getFollowUpLast30d() : "-").append("\n");
            });

        return sb.toString();
    }

    /** Puntaje de urgencia descendente: onboarding 1-7 > 8-14 sin HO > AVA<10% > churn > resto. */
    private int urgencyScore(Store s) {
        int aging = s.getAging() != null ? s.getAging() : 999;
        boolean noHo = !Boolean.TRUE.equals(s.getHadHandoff());
        double ava = s.getConnectionPercentage() != null ? s.getConnectionPercentage().doubleValue() : 100;
        String status = s.getCurrentStatus() != null ? s.getCurrentStatus().toLowerCase() : "";

        if (aging <= 7 && noHo)                  return 100; // onboarding crítico sin activar
        if (aging >= 8 && aging <= 14 && noHo)   return 90;  // ventana aliados sin HO
        if (aging >= 8 && aging <= 14 && ava < 60) return 85;  // ventana aliados AVA baja
        if (ava < 10)                             return 80;  // AVA muy baja (<10%)
        if (status.contains("churn"))             return 70;  // churn activo
        if (ava < 30)                             return 60;  // AVA baja
        if (noHo)                                 return 50;  // sin HO fuera de ventana
        return 10;
    }

    // ── Resumen diario ────────────────────────────────────────────────────────

    public String generateDailySummary(int efectivas, int noContacto, int whatsappEnviados,
                                       int tiendas, String topPrioridades) {
        String systemPrompt = """
                Eres el asistente de análisis de un Account Manager de Rappi Colombia.
                Generas resúmenes de rendimiento diario concisos y accionables.
                Usa bullets, emojis moderados y sé directo. Máximo 200 palabras.
                """;

        String userPrompt = String.format("""
                Resumen del día de gestión:
                - Gestiones efectivas: %d (meta: 15)
                - No contactos: %d (meta: 25-40)
                - WhatsApp enviados: %d (máx: 40)
                - Total tiendas activas: %d
                - Top prioridades pendientes: %s

                Incluye: desempeño vs metas, observaciones clave y 2 recomendaciones concretas para mañana.
                """, efectivas, noContacto, whatsappEnviados, tiendas, topPrioridades);

        return callGroq(systemPrompt, userPrompt, 0.6, 400);
    }

    // ── HTTP a Groq ───────────────────────────────────────────────────────────

    private String callGroqMessages(List<Map<String, String>> messages, double temperature, int maxTokens) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("IA no disponible: configura GROQ_API_KEY");
        }
        Map<String, Object> body = Map.of(
                "model", MODEL, "temperature", temperature,
                "max_tokens", maxTokens, "messages", messages);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    GROQ_URL, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            var choices = (List<?>) response.getBody().get("choices");
            var message = (Map<?, ?>) ((Map<?, ?>) choices.get(0)).get("message");
            return ((String) message.get("content")).trim();
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Error Groq API {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Error IA " + e.getStatusCode());
        } catch (Exception e) {
            log.error("Error inesperado llamando Groq: {}", e.getMessage());
            throw new RuntimeException("Error IA: " + e.getMessage());
        }
    }

    private String callGroq(String systemPrompt, String userPrompt, double temperature, int maxTokens) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("IA no disponible: configura GROQ_API_KEY");
        }

        Map<String, Object> body = Map.of(
                "model",       MODEL,
                "temperature", temperature,
                "max_tokens",  maxTokens,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user",   "content", userPrompt)
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    GROQ_URL, HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    Map.class);

            var choices = (List<?>) response.getBody().get("choices");
            var message = (Map<?, ?>) ((Map<?, ?>) choices.get(0)).get("message");
            String content = ((String) message.get("content")).trim();
            log.debug("IA generó {} chars", content.length());
            return content;
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Error Groq API {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Error IA " + e.getStatusCode());
        } catch (Exception e) {
            log.error("Error inesperado llamando Groq: {}", e.getMessage());
            throw new RuntimeException("Error IA: " + e.getMessage());
        }
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }
}
