package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.dtos.ManagementViewDto;
import com.rappi.farmer.application.dtos.RegisterManagementRequest;
import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.services.ManagementService;
import com.rappi.farmer.application.services.StoreDetailService;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.repositories.StoreRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreDetailService storeDetailService;
    private final ManagementService managementService;
    private final StoreRepository storeRepository;

    @GetMapping
    public ResponseEntity<List<StoreViewDto>> getStores(@RequestParam(required = false) String q) {
        List<StoreViewDto> stores = (q != null && !q.isBlank())
                ? storeDetailService.searchStores(q)
                : storeDetailService.getActiveStores();
        return ResponseEntity.ok(stores);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getStore(@PathVariable Long id) {
        return storeDetailService.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/connection-analysis")
    public ResponseEntity<Map<String, String>> getConnectionAnalysis(@PathVariable Long id) {
        String analysis = storeDetailService.getConnectionAnalysis(id);
        String lastManagement = storeDetailService.getLastManagementSummary(id);
        return ResponseEntity.ok(Map.of("analysis", analysis, "lastManagement", lastManagement));
    }

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
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (BusinessException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/by-base-type")
    public ResponseEntity<List<StoreViewDto>> getStoresByBaseType(
            @RequestParam String type,
            @RequestParam List<Long> farmerIds,
            @RequestParam(required = false, defaultValue = "7") int activeDays,
            @RequestParam(required = false, defaultValue = "W1") String churnFilter) {
        if (farmerIds == null || farmerIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<StoreViewDto> stores = switch (type) {
            case "ACTIVE"     -> storeDetailService.toViewDtos(storeRepository.findActiveNoLoginByFarmerIds(farmerIds, activeDays));
            case "CHURN"      -> storeDetailService.toViewDtos(switch (churnFilter) {
                case "M1" -> storeRepository.findChurnM1ByFarmerIds(farmerIds);
                default   -> storeRepository.findChurnByFarmerIds(farmerIds);
            });
            case "ACTIVE_F7D" -> storeDetailService.toViewDtos(storeRepository.findActiveF7dByFarmerIds(farmerIds));
            case "RETENCION"  -> storeDetailService.toViewDtos(storeRepository.findRetencionByFarmerIds(farmerIds));
            case "AVA_8_14"   -> storeDetailService.toViewDtos(storeRepository.findAva8a14ByFarmerIds(farmerIds));
            default           -> storeDetailService.toViewDtos(storeRepository.findAllActiveByFarmerIds(farmerIds));
        };
        return ResponseEntity.ok(stores);
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
