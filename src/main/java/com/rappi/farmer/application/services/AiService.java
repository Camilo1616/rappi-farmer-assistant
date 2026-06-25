package com.rappi.farmer.application.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.presentation.api.AiController;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.rappi.farmer.domain.exceptions.RateLimitException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class AiService {

    private static final String GROQ_URL  = "https://api.groq.com/openai/v1/chat/completions";
    /** Modelo rápido para WhatsApp/recomendaciones. */
    private static final String MODEL     = "llama-3.1-8b-instant";
    /** Modelo con mejor seguimiento de instrucciones para follow-up chat. */
    private static final String MODEL_FU  = "llama-3.3-70b-versatile";

    private final String apiKey;
    private final RestTemplate restTemplate = new RestTemplate();

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
        if ("Retención".equals(avaLabel) || (avaPct != null && avaPct < 30)) {
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
    public Map<String, Object> generateRecommendation(List<Store> stores, Long userId) {
        // Fecha de la última carga del Excel (uploadDate más reciente entre las tiendas activas)
        LocalDate lastUpload = stores.stream()
                .map(Store::getUploadDate)
                .filter(d -> d != null)
                .max(LocalDate::compareTo)
                .orElse(LocalDate.now());
        LocalDate today = LocalDate.now();

        String context = buildStoreContext(stores);

        String systemPrompt = """
                Eres el asistente estratégico de un Account Manager (AM) de Rappi Colombia.
                Analizas la cartera de restaurantes y priorizas las acciones del día.
                Respondes SIEMPRE en JSON válido, sin texto adicional, sin markdown, sin comillas extra.
                NUNCA menciones si la cartera es "del día anterior" ni comentes sobre la fecha de carga de datos.
                Los datos son los vigentes que el AM cargó esta mañana — tratar siempre como datos de HOY.
                """;

        String userPrompt = String.format("""
                HOY ES: %s
                ÚLTIMA CARGA DEL EXCEL: %s (estos son los datos vigentes de la cartera — NO comentar sobre la fecha de carga)

                Eres el asistente de un Account Manager (AM) de Rappi Colombia que gestiona la activación y retención de restaurantes aliados.

                GLOSARIO IMPORTANTE:
                - HO (Handoff): activación del restaurante en la app Rappi Aliados. Sin HO el restaurante NO puede recibir pedidos.
                - AVA MTD %%: porcentaje de conexión mensual con Rappi Aliados. Meta mínima: 60%%.
                - IS: estado "In Store" — el AM visitó o va a visitar la tienda físicamente hoy. Máxima urgencia.
                - Aging: días desde que el restaurante entró al programa. Ventana crítica: días 1-14.
                - FU30d: si el restaurante tuvo algún seguimiento en los últimos 30 días (SI/NO).
                - UltimoFU: hace cuántos días fue el último follow-up.
                - Gestionar: campo de acción sugerida del sistema (IS, WhatsApp, Llamada, etc.).

                REGLAS DE PRIORIZACIÓN:
                1. IS (días 1-14): ACCIÓN HOY — visita en tienda programada, coordinar activación en sitio.
                2. Aging 1-7 días HO=NO: ALTA urgencia — contactar para activar Rappi Aliados inmediatamente.
                3. Aging 1-7 días HO=SI: verificar que ya esté recibiendo pedidos y AVA > 0%%.
                4. Aging 8-14 días HO=NO: ALTA urgencia — se perdió la ventana ideal, recuperar activación.
                5. Aging 8-14 días AVA < 60%%: ALTA — reforzar uso de app Rappi Aliados.
                6. Churn activo: retención urgente, preguntar por problemas y ofrecer solución concreta.
                7. AVA < 40%% fuera de ventana: MEDIA — monitoreo de conexión.
                8. FU30d=NO con >7 días sin contacto: MEDIA — check-in mínimo.

                Devuelve ÚNICAMENTE este JSON válido (sin markdown, sin texto extra):
                {
                  "message": "Resumen estratégico para HOY (%s): cuántas tiendas en ventana crítica, cuántas IS, y el foco principal. 2-3 oraciones directas y motivadoras. NO mencionar fecha de carga ni día anterior.",
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

                ⚠️ REGLAS OBLIGATORIAS:
                1. INCLUYE SIEMPRE el 100%% de las tiendas de "ONBOARDING 1-7 DÍAS" y "ONBOARDING 8-14 DÍAS" — son ventana crítica y NO se pueden omitir.
                2. Completa con tiendas IS, Churn y AVA hasta llegar a máximo 30 en "priorities".
                3. SOLO incluye tiendas que aparezcan EXACTAMENTE en la CARTERA SEGMENTADA de abajo.
                4. NO inventes códigos. NO incluyas tiendas que no estén en la lista.
                Ordena de más a menos urgente.

                CARTERA SEGMENTADA:
                """, today, lastUpload, today) + context;

        String raw = callGroq(systemPrompt, userPrompt, 0.3, 4000);

        try {
            // Limpiar posible markdown code block
            String json = raw.trim();
            if (json.startsWith("```")) {
                json = json.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
            }
            Map<String, Object> result = new ObjectMapper().readValue(json, Map.class);
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
                - IMPORTANTE: NO tienes acceso a las gestiones registradas hoy (llamadas, WhatsApps, etc.).
                  Si preguntan cuántas gestiones llevan, responde exactamente: "No tengo acceso a tus gestiones de hoy — consulta el contador en el Dashboard."

                """ + context;

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        if (history != null && !history.isEmpty()) {
            List<AiController.ChatMessage> trimmed = history.size() > 8
                    ? history.subList(history.size() - 8, history.size()) : history;
            for (AiController.ChatMessage m : trimmed) {
                messages.add(Map.of("role", m.role(), "content", m.content()));
            }
        }
        messages.add(Map.of("role", "user", "content", userMessage));

        return callGroqMessages(messages, 0.5, 500);
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

        appendChatSegment(sb, "IS", isStores, today, 3);
        appendChatSegment(sb, "1-7d", seg17, today, 5);
        appendChatSegment(sb, "8-14d", seg814, today, 5);
        appendChatSegment(sb, "Churn", churn, today, 4);
        appendChatSegment(sb, "AVA<60%", avaLow, today, 3);

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
    private String buildStoreContext(List<Store> stores) {
        LocalDate today = LocalDate.now();
        StringBuilder sb = new StringBuilder();
        sb.append("=== RESUMEN CARTERA ===\n");
        sb.append("Total tiendas activas: ").append(stores.size()).append("\n\n");

        List<Store> seg17    = new ArrayList<>();
        List<Store> seg814   = new ArrayList<>();
        List<Store> churn    = new ArrayList<>();
        List<Store> avaLow   = new ArrayList<>();
        List<Store> isStores = new ArrayList<>();
        List<Store> resto    = new ArrayList<>();

        for (Store s : stores) {
            int aging = resolveAging(s);
            double ava = s.getConnectionPercentage() != null ? s.getConnectionPercentage().doubleValue() : 100;
            String status = s.getCurrentStatus() != null ? s.getCurrentStatus().toLowerCase() : "";
            String gestionar = s.getGestionar() != null ? s.getGestionar().toUpperCase() : "";

            boolean isInStore = gestionar.equals("IS") || gestionar.contains("IN STORE") || gestionar.contains("INSTORE");
            if (isInStore && aging <= 14) { isStores.add(s); continue; }
            if (aging >= 1 && aging <= 7)  { seg17.add(s);  continue; }
            if (aging >= 8 && aging <= 14) { seg814.add(s); continue; }
            if (status.contains("churn"))  { churn.add(s);  continue; }
            if (ava < 40 && ava > 0)       { avaLow.add(s); continue; }
            resto.add(s);
        }

        // Onboarding 1-14 y IS: TODOS (son pocos y son la prioridad máxima)
        appendSegment(sb, "🔴 PRIORIDAD MÁXIMA — IS (acción HOY)",
                isStores, Integer.MAX_VALUE, today,
                "Visita en tienda programada. Deben ser contactadas HOY sin falta.");
        appendSegment(sb, "🔴 ONBOARDING 1-7 DÍAS (ventana crítica)",
                seg17, Integer.MAX_VALUE, today,
                "Primeros 7 días = los más críticos. HO=NO significa que el Handoff (activación) no ocurrió.");
        appendSegment(sb, "🟠 ONBOARDING 8-14 DÍAS (ventana AVA/Aliados)",
                seg814, Integer.MAX_VALUE, today,
                "Meta AVA > 60%. Si AVA baja o HO=NO actuar urgente.");

        // Churn y AVA: máximo 8 cada uno para no saturar el contexto
        appendSegment(sb, "🔴 CHURN ACTIVO",
                churn, 8, today,
                "Riesgo de abandonar Rappi. Retención urgente.");
        appendSegment(sb, "🟡 AVA BAJA (< 40%)",
                avaLow, 8, today,
                "Conexión Rappi Aliados por debajo del objetivo.");

        if (!resto.isEmpty()) {
            sb.append("\n📋 Otras tiendas activas: ").append(resto.size())
              .append(" (estables, solo si hay tiempo)\n");
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

    /**
     * Chat de follow-up enfocado en una tienda específica.
     * La IA recibe el historial completo de gestiones/comentarios de esa tienda.
     * Si history está vacío genera un resumen automático de los comentarios.
     */
    public String followUpChat(Store store, List<com.rappi.farmer.domain.entities.Management> gestiones,
                               List<AiController.ChatMessage> history, String userMessage) {
        String storeContext = buildFollowUpContext(store, gestiones);

        String systemPrompt = """
                Eres el asistente de seguimiento de un Account Manager (AM) de Rappi Colombia.
                Tienes acceso al historial completo de gestiones registradas para esta tienda.

                GLOSARIO:
                - HO: Handoff = activación en Rappi Aliados. Sin HO no puede recibir pedidos.
                - AVA%: conexión mensual con Rappi Aliados. Meta mínima: 60%.
                - EFECTIVA: contacto exitoso con el aliado.
                - NO_CONTACTO: intento sin respuesta.
                - Palancas: acciones comerciales (Ads, Markdown, Catálogo, Churn, Sprints, etc.).

                FORMATO OBLIGATORIO — SIEMPRE usa markdown estructurado:
                - Para problemas recurrentes: usa lista con **negrita** en el problema
                - Para próxima acción: sección con ### y bullet points
                - NUNCA repitas la tabla de gestiones — el farmer ya la ve en pantalla
                - NUNCA escribas párrafos largos de texto corrido cuando una lista es más claro
                - Usa **negrita** para resaltar datos clave

                REGLAS DE CONTENIDO:
                - EL COMENTARIO DEL FARMER ES LA FUENTE MÁS IMPORTANTE — cítalo textualmente al identificar problemas
                - Identifica PROBLEMAS RECURRENTES: si el aliado menciona el mismo problema varias veces, resáltalo
                - Menciona quién registró cada gestión (farmerName) cuando esté disponible
                - Sugiere próxima acción basada en los comentarios reales, no solo en datos técnicos
                - Máximo 450 palabras. Sin inventar información que no esté en el historial.
                """ + storeContext;

        boolean isFirstMessage = (history == null || history.isEmpty());
        String effectiveMessage = isFirstMessage
                ? "Analiza el historial de gestiones de esta tienda. El farmer ya ve la tabla de gestiones en pantalla, NO la repitas. Responde SOLO con:\n\n### Problemas recurrentes\n(lista con **negrita** los problemas que se mencionan más de una vez en los comentarios; si no hay, di 'Sin problemas recurrentes identificados')\n\n### Próxima acción recomendada\n(2-3 bullet points concretos basados en los comentarios reales del farmer)"
                : userMessage;

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        if (history != null && !history.isEmpty()) {
            // Últimos MAX_HISTORY_TURNS turnos para no saturar el contexto
            List<AiController.ChatMessage> trimmed = history.size() > MAX_HISTORY_TURNS
                    ? history.subList(history.size() - MAX_HISTORY_TURNS, history.size())
                    : history;
            for (AiController.ChatMessage m : trimmed) {
                messages.add(Map.of("role", m.role(), "content", m.content()));
            }
        }
        messages.add(Map.of("role", "user", "content", effectiveMessage));

        return callGroqMessages(messages, 0.4, 600, MODEL_FU);
    }

    private static final int MAX_GESTIONES_CONTEXT = 20;
    private static final int MAX_COMMENT_CHARS     = 700;
    private static final int MAX_HISTORY_TURNS     = 6;

    private String buildFollowUpContext(Store store, List<com.rappi.farmer.domain.entities.Management> gestiones) {
        StringBuilder sb = new StringBuilder();
        sb.append("\n\nTIENDA: ").append(store.getStoreName());
        if (store.getStoreCode() != null)         sb.append(" | Código: ").append(store.getStoreCode());
        if (store.getBrandId() != null)           sb.append(" | Brand: ").append(store.getBrandId());
        if (store.getConnectionPercentage() != null) sb.append(" | AVA: ").append(store.getConnectionPercentage()).append("%");
        if (store.getCurrentStatus() != null)     sb.append(" | Estado: ").append(store.getCurrentStatus());
        sb.append(" | HO: ").append(Boolean.TRUE.equals(store.getHadHandoff()) ? "Sí" : "No").append("\n");

        int total = gestiones.size();
        List<com.rappi.farmer.domain.entities.Management> recientes = gestiones.stream()
                .limit(MAX_GESTIONES_CONTEXT).toList();

        sb.append("GESTIONES (").append(total).append(" total, mostrando ").append(recientes.size()).append(" más recientes):\n");
        if (recientes.isEmpty()) {
            sb.append("Sin gestiones registradas.\n");
        } else {
            for (com.rappi.farmer.domain.entities.Management m : recientes) {
                String fecha = m.getManagementDate() != null ? m.getManagementDate().toLocalDate().toString() : "?";
                String farmer = m.getFarmerName() != null && !m.getFarmerName().isBlank() ? " [" + m.getFarmerName() + "]" : "";
                String comentario = m.getComments() != null && !m.getComments().isBlank()
                        ? m.getComments().substring(0, Math.min(m.getComments().length(), MAX_COMMENT_CHARS))
                        : "(sin comentario)";
                sb.append(fecha)
                  .append(" [").append(m.getManagementType()).append("] ")
                  .append("[").append(m.getResultType()).append("]")
                  .append(farmer)
                  .append(" — ").append(comentario).append("\n");
            }
        }
        return sb.toString();
    }

    /** No-op: el caché de recomendación vive solo en BD (ver AiController). */
    public void clearRecommendationCache(Long userId) {}

    /** Calcula el aging real: usa el campo stored; si es null lo deriva de onboarding_date. */
    private int resolveAging(Store s) {
        // Misma lógica que DashboardService.calcAgingEfectivo:
        // uploadDate = cuándo se cargó esta tienda al Excel del farmer (días en cartera)
        if (s.getUploadDate() != null)
            return (int) java.time.temporal.ChronoUnit.DAYS.between(s.getUploadDate(), LocalDate.now());
        if (s.getOnboardingDate() != null)
            return (int) java.time.temporal.ChronoUnit.DAYS.between(s.getOnboardingDate(), LocalDate.now());
        return s.getAging() != null ? s.getAging() : 999;
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
        return callGroqMessages(messages, temperature, maxTokens, MODEL);
    }

    private String callGroqMessages(List<Map<String, String>> messages, double temperature, int maxTokens, String model) {
        if (apiKey == null || apiKey.isBlank())
            throw new IllegalStateException("IA no disponible: configura GROQ_API_KEY");
        Map<String, Object> body = Map.of(
                "model", model, "temperature", temperature,
                "max_tokens", maxTokens, "messages", messages);
        return executeWithRetry(body);
    }

    private String callGroq(String systemPrompt, String userPrompt, double temperature, int maxTokens) {
        if (apiKey == null || apiKey.isBlank())
            throw new IllegalStateException("IA no disponible: configura GROQ_API_KEY");
        Map<String, Object> body = Map.of(
                "model", MODEL, "temperature", temperature, "max_tokens", maxTokens,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user",   "content", userPrompt)));
        return executeWithRetry(body);
    }

    /**
     * Ejecuta la llamada a Groq con un reintento automático si llega un 429.
     * Parsea el tiempo de espera sugerido por Groq ("try again in Xs") y duerme ese tiempo
     * antes de reintentar (máximo 30 s para no bloquear el hilo demasiado).
     */
    private String executeWithRetry(Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        String lastErrorBody = null;

        for (int attempt = 0; attempt <= 1; attempt++) {
            try {
                ResponseEntity<Map> response = restTemplate.exchange(
                        GROQ_URL, HttpMethod.POST, entity, Map.class);
                var choices = (List<?>) response.getBody().get("choices");
                var message = (Map<?, ?>) ((Map<?, ?>) choices.get(0)).get("message");
                return ((String) message.get("content")).trim();

            } catch (org.springframework.web.client.HttpClientErrorException e) {
                if (e.getStatusCode().value() == 429) {
                    lastErrorBody = e.getResponseBodyAsString();
                    if (attempt == 0) {
                        long waitMs = parse429WaitMs(lastErrorBody);
                        log.warn("Groq 429 — esperando {}ms antes de reintentar", waitMs);
                        try { Thread.sleep(waitMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    }
                } else {
                    log.error("Error Groq API {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
                    throw new RuntimeException("Error IA " + e.getStatusCode());
                }
            } catch (Exception e) {
                log.error("Error inesperado llamando Groq: {}", e.getMessage());
                throw new RuntimeException("Error IA: " + e.getMessage());
            }
        }
        // Ambos intentos fallaron — calcular cuánto debe esperar el cliente
        long retrySecs = parse429RetryAfterSeconds(lastErrorBody != null ? lastErrorBody : "");
        log.warn("Groq 429 persistente — cliente debe esperar {}s", retrySecs);
        throw new RateLimitException(retrySecs);
    }

    /** Extrae segundos de espera para el reintento del servidor (ms, máx 30s). */
    private long parse429WaitMs(String body) {
        try {
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("try again in ([0-9.]+)s").matcher(body);
            if (m.find()) return Math.min((long)(Double.parseDouble(m.group(1)) * 1000) + 500, 30_000);
        } catch (Exception ignored) {}
        return 12_000;
    }

    /** Extrae segundos de espera para devolver al cliente (segundos enteros). */
    private long parse429RetryAfterSeconds(String body) {
        try {
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("try again in ([0-9.]+)s").matcher(body);
            if (m.find()) return (long) Math.ceil(Double.parseDouble(m.group(1)));
        } catch (Exception ignored) {}
        return 30;
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }
}
