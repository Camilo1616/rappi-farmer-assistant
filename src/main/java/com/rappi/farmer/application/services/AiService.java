package com.rappi.farmer.application.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rappi.farmer.application.dtos.AgmHistorialEntryDto;
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
    /** Modelo rápido con límite de tokens/min 3x mayor que versatile. */
    private static final String MODEL     = "llama-3.1-8b-instant";
    private static final String MODEL_FU  = "llama-3.1-8b-instant";

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

        String systemPrompt = "Asistente AM Rappi Colombia. Responde SOLO JSON válido, sin markdown ni texto extra.";

        String userPrompt = String.format("""
                HOY: %s. CARTERA:
                HO=activación Aliados. AVA%%=conexión mensual(meta>60%%). IS=visita física hoy. Aging=días en programa.

                JSON sin markdown:
                {"message":"2 oraciones: tiendas críticas hoy y foco principal.",
                 "priorities":[{"storeCode":"...","storeName":"...","priority":"ALTA|MEDIA|BAJA","reason":"...","action":"..."}]}

                Reglas: IS>1-7dHO=NO>8-14dHO=NO>8-14dAVA<60>CHURN>AVA<40. Máx 25 en priorities. Solo tiendas de la lista. Sin inventar.

                """, today, lastUpload) + context;

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

        appendCompact(sb, "IS",    isStores, 5,  today);
        appendCompact(sb, "1-7d",  seg17,    8,  today);
        appendCompact(sb, "8-14d", seg814,   8,  today);
        appendCompact(sb, "CHURN", churn,    5,  today);
        appendCompact(sb, "AVA<40",avaLow,   5,  today);

        if (!resto.isEmpty())
            sb.append("ESTABLES:").append(resto.size()).append("\n");

        return sb.toString();
    }

    /** Formato ultra-compacto: CODE|Nombre|Aging|HO|AVA|Estado|FU */
    private void appendCompact(StringBuilder sb, String title, List<Store> stores, int max, LocalDate today) {
        if (stores.isEmpty()) return;
        sb.append("\n[").append(title).append(" total=").append(stores.size()).append("]\n");
        stores.stream()
            .sorted((a, b) -> Integer.compare(urgencyScore(b), urgencyScore(a)))
            .limit(max)
            .forEach(s -> {
                long fu = s.getLastFollowUp() != null
                    ? java.time.temporal.ChronoUnit.DAYS.between(s.getLastFollowUp(), today) : -1;
                sb.append(s.getStoreCode() != null ? s.getStoreCode() : "-").append("|")
                  .append(s.getStoreName() != null ? s.getStoreName() : "-").append("|")
                  .append(resolveAging(s) < 999 ? resolveAging(s) + "d" : "-").append("|")
                  .append(Boolean.TRUE.equals(s.getHadHandoff()) ? "HO=SI" : "HO=NO").append("|")
                  .append(s.getConnectionPercentage() != null ? s.getConnectionPercentage().toPlainString() + "%" : "-").append("|")
                  .append(s.getCurrentStatus() != null ? s.getCurrentStatus() : "-").append("|")
                  .append(fu >= 0 ? fu + "dFU" : "sinFU").append("|")
                  .append(s.getGestionar() != null ? s.getGestionar() : "-")
                  .append("\n");
            });
        if (stores.size() > max) sb.append("...+").append(stores.size() - max).append(" más\n");
    }

    /**
     * Chat de follow-up enfocado en una tienda específica.
     * La IA recibe el historial de cambios de estado de esa tienda registrado en AGM-IA (Google Sheet).
     * Si history está vacío genera un resumen automático de lo que pasó.
     */
    public String followUpChat(Store store, List<AgmHistorialEntryDto> historialAgm,
                               List<AiController.ChatMessage> history, String userMessage) {
        String storeContext = buildFollowUpContext(store, historialAgm);

        String systemPrompt = """
                Asistente de seguimiento de tiendas Rappi. HO=activación Aliados. AVA%=conexión(meta>60%).
                El historial viene de la gestión AGM-IA: cada línea es un cambio de estado hecho por un agente.
                USA MARKDOWN: ### para títulos, **negrita** para datos clave, - para listas.
                NO repitas la tabla de historial (el farmer ya la ve). Máx 300 palabras. Sin inventar.
                """ + storeContext;

        boolean isFirstMessage = (history == null || history.isEmpty());
        String effectiveMessage = isFirstMessage
                ? "Analiza el historial de gestión AGM-IA de esta tienda. El farmer ya ve la tabla en pantalla, NO la repitas. Responde SOLO con:\n\n### Qué pasó\n(resumen breve de la secuencia de estados y comentarios más relevantes)\n\n### Problemas recurrentes\n(lista con **negrita** los problemas que se mencionan más de una vez en los comentarios; si no hay, di 'Sin problemas recurrentes identificados')\n\n### Próxima acción recomendada\n(2-3 bullet points concretos basados en los comentarios reales del agente)"
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

    private static final int MAX_GESTIONES_CONTEXT = 8;
    private static final int MAX_COMMENT_CHARS     = 180;
    private static final int MAX_HISTORY_TURNS     = 6;

    private String buildFollowUpContext(Store store, List<AgmHistorialEntryDto> historialAgm) {
        StringBuilder sb = new StringBuilder();
        sb.append("\n\nTIENDA: ").append(store.getStoreName());
        if (store.getStoreCode() != null)         sb.append(" | Código: ").append(store.getStoreCode());
        if (store.getBrandId() != null)           sb.append(" | Brand: ").append(store.getBrandId());
        if (store.getConnectionPercentage() != null) sb.append(" | AVA: ").append(store.getConnectionPercentage()).append("%");
        if (store.getCurrentStatus() != null)     sb.append(" | Estado: ").append(store.getCurrentStatus());
        sb.append(" | HO: ").append(Boolean.TRUE.equals(store.getHadHandoff()) ? "Sí" : "No").append("\n");

        int total = historialAgm.size();
        // El historial viene más reciente primero — se toman los N más recientes.
        List<AgmHistorialEntryDto> recientes = historialAgm.stream().limit(MAX_GESTIONES_CONTEXT).toList();

        sb.append("HISTORIAL AGM-IA (").append(total).append(" cambios en total, mostrando ").append(recientes.size()).append(" más recientes):\n");
        if (recientes.isEmpty()) {
            sb.append("Sin historial de gestión AGM registrado para esta tienda.\n");
        } else {
            for (AgmHistorialEntryDto h : recientes) {
                String agente = h.agente() != null && !h.agente().isBlank() ? " [" + h.agente() + "]" : "";
                String comentario = combinarComentarios(h);
                sb.append(h.fechaHora() != null ? h.fechaHora() : "?")
                  .append(" [").append(h.status() != null && !h.status().isBlank() ? h.status() : "sin status").append("]")
                  .append(agente)
                  .append(" — ").append(comentario).append("\n");
            }
        }
        return sb.toString();
    }

    private String combinarComentarios(AgmHistorialEntryDto h) {
        String interno = h.comentarioInterno() != null ? h.comentarioInterno().trim() : "";
        String aliado  = h.comentarioAliado()  != null ? h.comentarioAliado().trim()  : "";
        StringBuilder sb = new StringBuilder();
        if (!interno.isBlank()) sb.append("Interno: ").append(interno);
        if (!aliado.isBlank()) sb.append(sb.length() > 0 ? " | " : "").append("Aliado: ").append(aliado);
        if (sb.length() == 0) return "(sin comentario)";
        return sb.length() > MAX_COMMENT_CHARS ? sb.substring(0, MAX_COMMENT_CHARS) : sb.toString();
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
