package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> status() {
        return ResponseEntity.ok(Map.of("available", aiService.isAvailable()));
    }

    @PostMapping("/whatsapp-message")
    public ResponseEntity<?> generateWhatsappMessage(@RequestBody GenerateMessageRequest req) {
        try {
            String message = aiService.generateWhatsappMessage(
                    req.storeName(),
                    req.ownerName(),
                    req.agingDays(),
                    req.situation(),
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

    public record GenerateMessageRequest(
            String storeName,
            String ownerName,
            int agingDays,
            String situation,
            String baseTemplate) {}

    public record DailySummaryRequest(
            int efectivas,
            int noContacto,
            int whatsappEnviados,
            int tiendas,
            String topPrioridades) {}
}
