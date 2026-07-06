package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.dtos.ManagementViewDto;
import com.rappi.farmer.application.dtos.RegisterManagementRequest;
import com.rappi.farmer.application.services.AiService;
import com.rappi.farmer.application.services.ManagementService;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.exceptions.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Registro y ciclo de vida de gestiones (WhatsApp, llamada, SAC, etc.) sobre una tienda. */
@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
public class ManagementController {

    private final ManagementService managementService;
    private final AiService aiService;
    private final SessionContext sessionContext;

    @PostMapping("/{id}/management")
    public ResponseEntity<?> registerManagement(@PathVariable Long id,
            @Valid @RequestBody ManagementRequest request) {
        try {
            RegisterManagementRequest req = RegisterManagementRequest.builder()
                    .storeId(id)
                    .managementType(request.managementType())
                    .resultType(request.resultType())
                    .comments(request.comments())
                    .build();
            Management saved = managementService.register(req);
            aiService.clearRecommendationCache(sessionContext.getCurrentUserId());
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (BusinessException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/managements/today")
    public ResponseEntity<List<ManagementViewDto>> getTodayManagements() {
        return ResponseEntity.ok(managementService.getTodayManagements());
    }

    @PutMapping("/managements/{id}")
    public ResponseEntity<?> updateManagement(@PathVariable Long id,
            @Valid @RequestBody ManagementRequest request) {
        try {
            Management updated = managementService.update(id, request.managementType(), request.resultType(), request.comments());
            return ResponseEntity.ok(updated);
        } catch (BusinessException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/managements/{id}")
    public ResponseEntity<?> deleteManagement(@PathVariable Long id) {
        try {
            managementService.deleteManagement(id);
            return ResponseEntity.ok(Map.of("message", "Gestión eliminada"));
        } catch (BusinessException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    public record ManagementRequest(
            @NotBlank String managementType,
            @NotBlank String resultType,
            String comments) {}
}
