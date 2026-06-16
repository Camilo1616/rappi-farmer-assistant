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
import java.time.LocalDate;
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
        String context = buildStoreContext(stores, 5); // máx 5 por segmento → ~25 tiendas total

        String systemPrompt = """
                Eres el asistente estratégico de un Account Manager (AM) de Rappi Colombia.
                Analizas la cartera de restaurantes y priorizas las acciones del día.
                Respondes SIEMPRE en JSON válido, sin texto adicional, sin markdown, sin comillas extra.
                """;

        String userPrompt = """
                Eres el asistente de un Account Manager (AM) de Rappi Colombia que gestiona la activación y retención de restaurantes aliados.

                GLOSARIO IMPORTANTE:
                - HO (Handoff): activación del restaurante en la app Rappi Aliados. Sin HO el restaurante NO puede recibir pedidos.
                - AVA MTD %: porcentaje de conexión mensual con Rappi Aliados. Meta mínima: 60%.
                - IS: estado "In Store" — el AM visitó o va a visitar la tienda físicamente hoy. Máxima urgencia.
                - Aging: días desde que el restaurante entró al programa. Ventana crítica: días 1-14.
                - FU30d: si el restaurante tuvo algún seguimiento en los últimos 30 días (SI/NO).
                - UltimoFU: hace cuántos días fue el último follow-up.
                - Gestionar: campo de acción sugerida del sistema (IS, WhatsApp, Llamada, etc.).

                REGLAS DE PRIORIZACIÓN:
                1. IS (días 1-14): ACCIÓN HOY — visita en tienda programada, coordinar activación en sitio.
                2. Aging 1-7 días HO=NO: ALTA urgencia — contactar para activar Rappi Aliados inmediatamente.
                3. Aging 1-7 días HO=SI: verificar que ya esté recibiendo pedidos y AVA > 0%.
                4. Aging 8-14 días HO=NO: ALTA urgencia — se perdió la ventana ideal, recuperar activación.
                5. Aging 8-14 días AVA < 60%: ALTA — reforzar uso de app Rappi Aliados.
                6. Churn activo: retención urgente, preguntar por problemas y ofrecer solución concreta.
                7. AVA < 40% fuera de ventana: MEDIA — monitoreo de conexión.
                8. FU30d=NO con >7 días sin contacto: MEDIA — check-in mínimo.

                Devuelve ÚNICAMENTE este JSON válido (sin markdown, sin texto extra):
                {
                  "message": "Resumen estratégico del día para el AM: cuántas tiendas en ventana crítica, cuántas IS, y el foco principal de hoy. 2-3 oraciones directas.",
                  "priorities": [
                    {
                      "storeCode": "PE...",
                      "storeName": "Nombre del restaurante",
                      "priority": "ALTA|MEDIA|BAJA",
                      "reason": "Por qué es urgente hoy (menciona aging, HO, AVA o estado específico)",
                      "action": "Acción concreta y específica para hacer HOY"
                    }
                  ]
                }

                ⚠️ CRÍTICO: SOLO incluye tiendas que aparezcan EXACTAMENTE en la CARTERA SEGMENTADA de abajo.
                NO inventes códigos PE. NO incluyas tiendas que no estén en la lista.
                Si una tienda no aparece en la lista, no existe en esta cartera.
                Máximo 15 tiendas en "priorities", ordenadas de más a menos urgente.

                CARTERA SEGMENTADA:
                """ + context;

        String raw = callGroq(systemPrompt, userPrompt, 0.3, 2200);

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
     * Chat conversacional sobre la cartera. Ve toda la cartera en formato compacto.
     */
    public String chat(List<Store> stores, List<AiController.ChatMessage> history, String userMessage) {
        String context = buildChatContext(stores);

        String systemPrompt = """
                Eres el asistente estratégico de un Account Manager (AM) de Rappi Colombia.
                Gestionas la activación y retención de restaurantes aliados.

                GLOSARIO:
                - HO: Handoff = activación en Rappi Aliados. Sin HO el restaurante NO puede recibir pedidos.
                - AVA%: conexión mensual con Rappi Aliados. Meta mínima: 60%.
                - IS: visita física en tienda programada hoy — máxima urgencia.
                - Aging: días en el programa desde onboarding. Ventana crítica: 1-14 días.
                - FU30d: si hubo seguimiento en los últimos 30 días (SI/NO).
                - Churn: tienda en riesgo de abandonar la plataforma.
                - Prevention W1/W2/W3: niveles de alerta temprana de churn (W1=menor, W3=mayor).

                REGLAS DE RESPUESTA:
                - Responde SOLO con la información real de la CARTERA que se te proporciona.
                - Si preguntan por una tienda específica, búscala por código o nombre.
                - Para listas de tiendas usa tabla markdown: | Código | Nombre | Aging | HO | AVA% | Estado | Acción |
                - Para resúmenes numéricos usa los totales del encabezado de la cartera.
                - Máximo 400 palabras. Directo y accionable.
                - Énfasis con **negrita** en datos clave.

                """ + context;

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        if (history != null) {
            for (AiController.ChatMessage m : history) {
                messages.add(Map.of("role", m.role(), "content", m.content()));
            }
        }
        messages.add(Map.of("role", "user", "content", userMessage));

        return callGroqMessages(messages, 0.5, 1200);
    }

    /**
     * Contexto completo para el chat: todas las tiendas críticas en formato compacto.
     * A diferencia del contexto de recomendación (5/segmento), aquí se muestran todas
     * para que el AM pueda preguntar sobre cualquier tienda, churn, AVA, etc.
     */
    private String buildChatContext(List<Store> stores) {
        LocalDate today = LocalDate.now();

        List<Store> isStores = new ArrayList<>();
        List<Store> seg17    = new ArrayList<>();
        List<Store> seg814   = new ArrayList<>();
        List<Store> churn    = new ArrayList<>();
        List<Store> avaLow   = new ArrayList<>(); // AVA < 60%
        List<Store> resto    = new ArrayList<>();

        for (Store s : stores) {
            int aging = resolveAging(s);
            double ava = s.getConnectionPercentage() != null ? s.getConnectionPercentage().doubleValue() : 100;
            String status = s.getCurrentStatus() != null ? s.getCurrentStatus().toLowerCase() : "";
            String gestionar = s.getGestionar() != null ? s.getGestionar().toUpperCase() : "";
            boolean isInStore = gestionar.equals("IS") || gestionar.contains("IN STORE") || gestionar.contains("INSTORE");

            if (isInStore && aging <= 14)  { isStores.add(s); continue; }
            if (aging >= 1 && aging <= 7)  { seg17.add(s);   continue; }
            if (aging >= 8 && aging <= 14) { seg814.add(s);  continue; }
            if (status.contains("churn"))  { churn.add(s);   continue; }
            if (ava < 60 && ava > 0)       { avaLow.add(s);  continue; }
            resto.add(s);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("=== CARTERA COMPLETA ===\n");
        sb.append(String.format("Total: %d | IS: %d | 1-7d: %d | 8-14d: %d | Churn: %d | AVA<60%%: %d | Estables: %d\n\n",
                stores.size(), isStores.size(), seg17.size(), seg814.size(),
                churn.size(), avaLow.size(), resto.size()));

        appendChatSegment(sb, "IS — VISITA HOY", isStores, today, 8);
        appendChatSegment(sb, "ONBOARDING 1-7 DÍAS", seg17, today, 10);
        appendChatSegment(sb, "ONBOARDING 8-14 DÍAS", seg814, today, 10);
        appendChatSegment(sb, "CHURN ACTIVO", churn, today, 12);
        appendChatSegment(sb, "AVA < 60%", avaLow, today, 10);

        if (!resto.isEmpty()) {
            sb.append("\n[ESTABLES: ").append(resto.size()).append(" tiendas — sin urgencia inmediata]\n");
        }

        return sb.toString();
    }

    /** Formato compacto para chat: Código|Nombre|Aging|HO|AVA%|Estado|Gestionar */
    private void appendChatSegment(StringBuilder sb, String title, List<Store> stores,
                                   LocalDate today, int maxRows) {
        if (stores.isEmpty()) return;
        sb.append("--- ").append(title).append(" (").append(stores.size()).append(") ---\n");
        sb.append("Código|Nombre|Aging|HO|AVA%|Estado|FU30d|Gestionar\n");
        stores.stream()
            .sorted((a, b) -> Integer.compare(urgencyScore(b), urgencyScore(a)))
            .limit(maxRows)
            .forEach(s -> {
                int aging = resolveAging(s);
                double ava = s.getConnectionPercentage() != null ? s.getConnectionPercentage().doubleValue() : -1;
                sb.append(s.getStoreCode() != null ? s.getStoreCode() : "-").append("|")
                  .append(s.getStoreName() != null ? s.getStoreName() : "-").append("|")
                  .append(aging < 999 ? aging + "d" : "-").append("|")
                  .append(Boolean.TRUE.equals(s.getHadHandoff()) ? "SI" : "NO").append("|")
                  .append(ava >= 0 ? String.format("%.0f%%", ava) : "-").append("|")
                  .append(s.getCurrentStatus() != null ? s.getCurrentStatus() : "-").append("|")
                  .append(s.getFollowUpLast30d() != null ? s.getFollowUpLast30d() : "-").append("|")
                  .append(s.getGestionar() != null ? s.getGestionar() : "-").append("\n");
            });
        if (stores.size() > maxRows)
            sb.append("  ... y ").append(stores.size() - maxRows).append(" más en este segmento\n");
        sb.append("\n");
    }

    /**
     * Construye contexto segmentado por urgencia para la IA.
     * Agrupa tiendas por ventana crítica para que la IA priorice correctamente.
     */
    private String buildStoreContext(List<Store> stores, int maxPerSegment) {
        LocalDate today = LocalDate.now();
        StringBuilder sb = new StringBuilder();
        sb.append("=== RESUMEN CARTERA ===\n");
        sb.append("Total tiendas activas: ").append(stores.size()).append("\n\n");

        // Segmentar
        List<Store> seg17    = new ArrayList<>(); // onboarding 1-7 días (ventana IS crítica)
        List<Store> seg814   = new ArrayList<>(); // onboarding 8-14 días (ventana AVA/HO)
        List<Store> churn    = new ArrayList<>(); // churn activo
        List<Store> avaLow   = new ArrayList<>(); // AVA < 40%
        List<Store> isStores = new ArrayList<>(); // gestionar = IS (entraron hoy/reciente a IS)
        List<Store> resto    = new ArrayList<>();

        for (Store s : stores) {
            int aging = resolveAging(s);
            double ava = s.getConnectionPercentage() != null ? s.getConnectionPercentage().doubleValue() : 100;
            String status = s.getCurrentStatus() != null ? s.getCurrentStatus().toLowerCase() : "";
            String gestionar = s.getGestionar() != null ? s.getGestionar().toUpperCase() : "";

            boolean isInStore = gestionar.equals("IS") || gestionar.contains("IN STORE") || gestionar.contains("INSTORE");
            if (isInStore && aging <= 14) { isStores.add(s); continue; }
            if (aging >= 1  && aging <= 7)                { seg17.add(s);   continue; }
            if (aging >= 8  && aging <= 14)               { seg814.add(s);  continue; }
            if (status.contains("churn"))                 { churn.add(s);   continue; }
            if (ava < 40 && ava > 0)                      { avaLow.add(s);  continue; }
            resto.add(s);
        }

        appendSegment(sb, "🔴 PRIORIDAD MÁXIMA — IS (Ingresaron a IS, acción HOY)",
                isStores, maxPerSegment, today,
                "Estas tiendas acaban de entrar al estado IS. Deben ser contactadas HOY sin falta.");

        appendSegment(sb, "🔴 ONBOARDING 1-7 DÍAS (ventana crítica de activación)",
                seg17, maxPerSegment, today,
                "Primeros 7 días = los más críticos. Si no se activan aquí hay riesgo alto de churn. HO=NO significa que el Handoff (activación) aún no ocurrió.");

        appendSegment(sb, "🟠 ONBOARDING 8-14 DÍAS (ventana AVA/Aliados)",
                seg814, maxPerSegment, today,
                "Entre día 8-14 la meta es AVA > 60%. Si AVA es baja o HO=NO hay que actuar urgente.");

        appendSegment(sb, "🔴 CHURN ACTIVO",
                churn, maxPerSegment, today,
                "Tiendas en riesgo de abandonar Rappi. Requieren acción de retención inmediata.");

        appendSegment(sb, "🟡 AVA BAJA (< 40%)",
                avaLow, maxPerSegment, today,
                "Conexión Rappi Aliados por debajo del objetivo. Afecta directamente las ventas.");

        if (!resto.isEmpty()) {
            sb.append("\n📋 Otras tiendas activas: ").append(resto.size())
              .append(" (estables, solo check-in si hay tiempo)\n");
        }

        return sb.toString();
    }

    private void appendSegment(StringBuilder sb, String title, List<Store> stores,
                                int max, LocalDate today, String contexto) {
        if (stores.isEmpty()) return;
        sb.append("\n--- ").append(title).append(" ---\n");
        sb.append("Contexto: ").append(contexto).append("\n");
        sb.append("Columnas: Código | Nombre | Canal | Aging | HO | FechaHO | AVA% | Estado | UltimoFU | FU30d | Gestionar | UltimoLogin | CredsFecha\n");

        stores.stream()
            .sorted((a, b) -> Integer.compare(urgencyScore(b), urgencyScore(a)))
            .limit(max)
            .forEach(s -> {
                long diasSinFu = s.getLastFollowUp() != null
                    ? java.time.temporal.ChronoUnit.DAYS.between(s.getLastFollowUp(), today) : -1;

                sb.append(s.getStoreCode()).append(" | ")
                  .append(s.getStoreName() != null ? s.getStoreName() : "-").append(" | ")
                  .append(s.getChannel() != null ? s.getChannel() : "-").append(" | ")
                  .append(resolveAging(s) < 999 ? resolveAging(s) + "d" : "-").append(" | ")
                  .append(Boolean.TRUE.equals(s.getHadHandoff()) ? "HO=SI" : "HO=NO").append(" | ")
                  .append(s.getHandoffActivatedAt() != null ? s.getHandoffActivatedAt() : "sin-HO").append(" | ")
                  .append(s.getConnectionPercentage() != null
                      ? s.getConnectionPercentage().toPlainString() + "%" : "AVA=-").append(" | ")
                  .append(s.getCurrentStatus() != null ? s.getCurrentStatus() : "-").append(" | ")
                  .append(diasSinFu >= 0 ? diasSinFu + "d-sin-FU" : "sin-FU").append(" | ")
                  .append(s.getFollowUpLast30d() != null ? "FU30=" + s.getFollowUpLast30d() : "FU30=-").append(" | ")
                  .append(s.getGestionar() != null ? s.getGestionar() : "-").append(" | ")
                  .append(s.getLastLoginDate() != null ? "login=" + s.getLastLoginDate() : "sin-login").append(" | ")
                  .append(s.getCredentialsDate() != null ? "creds=" + s.getCredentialsDate() : "sin-creds")
                  .append("\n");
            });
    }

    /** Limpia la caché de recomendación (llamar al registrar una gestión). */
    public void clearRecommendationCache() {
        recCache.set(null);
    }

    /** Calcula el aging real: usa el campo stored; si es null lo deriva de onboarding_date. */
    private int resolveAging(Store s) {
        if (s.getAging() != null) return s.getAging();
        if (s.getOnboardingDate() != null)
            return (int) java.time.temporal.ChronoUnit.DAYS.between(s.getOnboardingDate(), LocalDate.now());
        return 999;
    }

    /** Puntaje de urgencia descendente por ventana crítica. */
    private int urgencyScore(Store s) {
        int aging = resolveAging(s);
        boolean noHo = !Boolean.TRUE.equals(s.getHadHandoff());
        double ava = s.getConnectionPercentage() != null ? s.getConnectionPercentage().doubleValue() : 100;
        String status = s.getCurrentStatus() != null ? s.getCurrentStatus().toLowerCase() : "";
        String gestionar = s.getGestionar() != null ? s.getGestionar().toUpperCase() : "";

        boolean isInStore = gestionar.equals("IS") || gestionar.contains("IN STORE") || gestionar.contains("INSTORE");
        if (isInStore && aging <= 14)                   return 110; // IS reciente = máxima urgencia
        if (aging <= 7  && noHo)                        return 100; // onboarding 1-7 sin HO
        if (aging <= 7  && !noHo)                       return 95;  // onboarding 1-7 con HO (check AVA)
        if (aging >= 8  && aging <= 14 && noHo)         return 90;  // ventana aliados sin HO
        if (aging >= 8  && aging <= 14 && ava < 60)     return 85;  // ventana aliados AVA baja
        if (ava < 10)                                   return 80;  // AVA crítica
        if (status.contains("churn"))                   return 70;  // churn activo
        if (ava < 30)                                   return 60;  // AVA baja
        if (noHo)                                       return 50;  // sin HO fuera de ventana
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
