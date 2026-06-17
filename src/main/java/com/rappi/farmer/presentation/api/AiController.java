package com.rappi.farmer.presentation.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.services.AiService;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.exceptions.RateLimitException;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.infrastructure.persistence.entity.DailyAiRecommendationEntity;
import com.rappi.farmer.infrastructure.persistence.repository.DailyAiRecommendationJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final StoreRepository storeRepository;
    private final ManagementRepository managementRepository;
    private final DailyAiRecommendationJpaRepository recRepository;
    private final SessionContext sessionContext;
    private final ObjectMapper objectMapper;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> status() {
        return ResponseEntity.ok(Map.of("available", aiService.isAvailable()));
    }

    @PostMapping("/whatsapp-message")
    public ResponseEntity<?> generateWhatsappMessage(@RequestBody GenerateMessageRequest req) {
        try {
            String message = aiService.generateWhatsappMessage(
                    req.storeName(), req.agingDays(), req.agingStage(), req.segment(),
                    req.churnLabel(), req.avaLabel(), req.avaPct(), req.currentStatus(), req.baseTemplate());
            return ResponseEntity.ok(Map.of("message", message));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error generando mensaje IA: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Error al generar mensaje: " + e.getMessage()));
        }
    }

    @PostMapping("/daily-summary")
    public ResponseEntity<?> generateDailySummary(@RequestBody DailySummaryRequest req) {
        try {
            String summary = aiService.generateDailySummary(
                    req.efectivas(), req.noContacto(), req.whatsappEnviados(), req.tiendas(), req.topPrioridades());
            return ResponseEntity.ok(Map.of("summary", summary));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error generando resumen IA: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Error al generar resumen: " + e.getMessage()));
        }
    }

    /**
     * Recomendación diaria persistida:
     * - Primera llamada del día → genera con IA y guarda en BD
     * - Llamadas posteriores → sirve desde BD (sin llamar a Groq)
     * - Enriquece con gestiones del día: storeCode → resultType (EFECTIVA/NO_CONTACTO)
     * - Si todas las tiendas fueron gestionadas → flag allDone=true
     */
    @GetMapping("/recommend")
    public ResponseEntity<?> recommend() {
        if (!aiService.isAvailable()) {
            return ResponseEntity.status(503).body(Map.of("error", "IA no disponible — configura GROQ_API_KEY"));
        }
        Long userId = sessionContext.getCurrentUserId();
        ZoneId colombia = ZoneId.of("America/Bogota");
        LocalDate today = LocalDate.now(colombia);
        ZonedDateTime nowCo = ZonedDateTime.now(colombia);

        // 1. Buscar recomendación guardada hoy
        Optional<DailyAiRecommendationEntity> saved = recRepository.findByUserIdAndRecDate(userId, today);

        // Invalidar recomendación si fue generada en otro día Colombia o antes del mediodía Colombia
        if (saved.isPresent()) {
            LocalDateTime createdAt = saved.get().getCreatedAt();
            if (createdAt != null) {
                // Convertir createdAt (UTC en DB) a hora Colombia
                ZonedDateTime createdCo = createdAt.atZone(ZoneId.of("UTC")).withZoneSameInstant(colombia);
                LocalDate createdDate   = createdCo.toLocalDate();
                ZonedDateTime noon      = today.atTime(12, 0).atZone(colombia);
                boolean staleYesterday  = createdDate.isBefore(today);
                boolean staleBeforeNoon = nowCo.isAfter(noon) && createdCo.isBefore(noon);
                if (staleYesterday || staleBeforeNoon) {
                    log.info("Rec userId={} invalidada — createdCo={} today={} staleYest={} staleNoon={}",
                            userId, createdCo, today, staleYesterday, staleBeforeNoon);
                    recRepository.delete(saved.get());
                    saved = Optional.empty();
                }
            }
        }

        String message;
        List<Map<String, Object>> priorities;

        if (saved.isPresent()) {
            // Servir desde BD
            try {
                message = saved.get().getMessage();
                priorities = objectMapper.readValue(saved.get().getPrioritiesJson(),
                        new TypeReference<List<Map<String, Object>>>() {});
                log.debug("Recomendación del día servida desde BD para userId={}", userId);
            } catch (Exception e) {
                log.warn("Error deserializando recomendación guardada, regenerando: {}", e.getMessage());
                saved = Optional.empty();
                message = null; priorities = null;
            }
        } else {
            message = null; priorities = null;
        }

        if (message == null) {
            // Generar nueva con IA
            List<Store> stores = storeRepository.findActiveByUser(userId);
            if (stores.isEmpty()) {
                return ResponseEntity.ok(Map.of("message", "Sin tiendas activas hoy.", "priorities", List.of(), "allDone", false));
            }
            try {
                Map<String, Object> result = aiService.generateRecommendation(stores, userId);
                message = (String) result.get("message");
                //noinspection unchecked
                priorities = (List<Map<String, Object>>) result.getOrDefault("priorities", List.of());

                // Guardar en BD para el resto del día
                DailyAiRecommendationEntity entity = new DailyAiRecommendationEntity();
                entity.setUserId(userId);
                entity.setRecDate(today); // today ya está en hora Colombia
                entity.setMessage(message);
                entity.setPrioritiesJson(objectMapper.writeValueAsString(priorities));
                entity.setCreatedAt(ZonedDateTime.now(ZoneId.of("UTC")).toLocalDateTime());
                recRepository.save(entity);
                log.info("Recomendación del día generada y guardada para userId={}, {} tiendas", userId, priorities.size());
            } catch (RateLimitException rle) {
                log.warn("Rate limit generando recomendación para userId={}: {}s", userId, rle.getRetryAfterSeconds());
                return ResponseEntity.status(429).body(Map.of(
                        "rateLimited", true,
                        "retryAfterSeconds", rle.getRetryAfterSeconds(),
                        "error", "Trabajando con otros farmers — intenta en " + rle.getRetryAfterSeconds() + "s"
                ));
            } catch (Exception e) {
                log.error("Error generando recomendación IA: {}", e.getMessage());
                return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
            }
        }

        // 2. Enriquecer con gestiones del día (storeCode → resultType)
        Map<String, String> managedResults = managementRepository.findTodayByUser(userId).stream()
                .filter(m -> !m.isBrandSync() && m.getStoreCode() != null)
                .collect(Collectors.toMap(
                        Management::getStoreCode,
                        m -> m.getResultType() != null ? m.getResultType() : "GESTIONADA",
                        (a, b) -> b)); // si hay varias gestiones del día para la misma tienda, toma la última

        // 3. Detectar si todas las tiendas recomendadas ya fueron gestionadas
        List<String> pendingCodes = priorities.stream()
                .map(p -> (String) p.get("storeCode"))
                .filter(code -> code != null && !managedResults.containsKey(code))
                .toList();
        boolean allDone = !priorities.isEmpty() && pendingCodes.isEmpty();

        return ResponseEntity.ok(Map.of(
                "message",        message,
                "priorities",     priorities,
                "managedResults", managedResults,
                "allDone",        allDone
        ));
    }

    /** Mini chat: el farmer pregunta sobre su cartera y la IA responde. */
    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody ChatRequest request) {
        if (!aiService.isAvailable()) {
            return ResponseEntity.status(503).body(Map.of("error", "IA no disponible"));
        }
        Long userId = sessionContext.getCurrentUserId();
        List<Store> stores = storeRepository.findActiveByUser(userId);
        try {
            String reply = aiService.chat(stores, request.history(), request.message());
            return ResponseEntity.ok(Map.of("reply", reply));
        } catch (RateLimitException rle) {
            return ResponseEntity.status(429).body(Map.of(
                    "rateLimited", true,
                    "retryAfterSeconds", rle.getRetryAfterSeconds()
            ));
        } catch (Exception e) {
            log.error("Error en chat IA: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    public record ChatMessage(String role, String content) {}
    public record ChatRequest(List<ChatMessage> history, String message) {}

    public record GenerateMessageRequest(
            String storeName, int agingDays, String agingStage, String segment,
            String churnLabel, String avaLabel, Double avaPct, String currentStatus, String baseTemplate) {}

    public record DailySummaryRequest(
            int efectivas, int noContacto, int whatsappEnviados, int tiendas, String topPrioridades) {}
}
