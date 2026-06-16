package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.services.AiService;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final StoreRepository storeRepository;
    private final ManagementRepository managementRepository;
    private final SessionContext sessionContext;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> status() {
        return ResponseEntity.ok(Map.of("available", aiService.isAvailable()));
    }

    @PostMapping("/whatsapp-message")
    public ResponseEntity<?> generateWhatsappMessage(@RequestBody GenerateMessageRequest req) {
        try {
            String message = aiService.generateWhatsappMessage(
                    req.storeName(),
                    req.agingDays(),
                    req.agingStage(),
                    req.segment(),
                    req.churnLabel(),
                    req.avaLabel(),
                    req.avaPct(),
                    req.currentStatus(),
                    req.baseTemplate()
            );
            return ResponseEntity.ok(Map.of("message", message));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error generando mensaje IA: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Error al generar mensaje: " + e.getMessage()));
        }
    }

    @PostMapping("/daily-summary")
    public ResponseEntity<?> generateDailySummary(@RequestBody DailySummaryRequest req) {
        try {
            String summary = aiService.generateDailySummary(
                    req.efectivas(),
                    req.noContacto(),
                    req.whatsappEnviados(),
                    req.tiendas(),
                    req.topPrioridades()
            );
            return ResponseEntity.ok(Map.of("summary", summary));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error generando resumen IA: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Error al generar resumen: " + e.getMessage()));
        }
    }

    /** Recomendación diaria: la IA lee la cartera y prioriza tiendas con justificación. */
    @GetMapping("/recommend")
    public ResponseEntity<?> recommend() {
        if (!aiService.isAvailable()) {
            return ResponseEntity.status(503).body(Map.of("error", "IA no disponible — configura GROQ_API_KEY"));
        }
        Long userId = sessionContext.getCurrentUserId();
        List<Store> allStores = storeRepository.findActiveByUser(userId);
        if (allStores.isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "Sin tiendas activas hoy.", "priorities", List.of()));
        }
        // Excluir tiendas ya gestionadas hoy para que la IA no las repita
        Set<Long> managedTodayIds = managementRepository.findTodayByUser(userId).stream()
                .filter(m -> !m.isBrandSync()) // ignorar propagaciones hermanas
                .map(Management::getStoreId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        List<Store> stores = managedTodayIds.isEmpty()
                ? allStores
                : allStores.stream().filter(s -> !managedTodayIds.contains(s.getId())).toList();
        try {
            Map<String, Object> result = aiService.generateRecommendation(stores, userId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error generando recomendación IA: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
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
        } catch (Exception e) {
            log.error("Error en chat IA: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    public record ChatMessage(String role, String content) {}
    public record ChatRequest(List<ChatMessage> history, String message) {}

    public record GenerateMessageRequest(
            String storeName,
            int agingDays,
            String agingStage,
            String segment,
            String churnLabel,
            String avaLabel,
            Double avaPct,
            String currentStatus,
            String baseTemplate) {}

    public record DailySummaryRequest(
            int efectivas,
            int noContacto,
            int whatsappEnviados,
            int tiendas,
            String topPrioridades) {}
}
