package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.services.StoreDetailService;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.repositories.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** CRUD y consulta de tiendas. Las gestiones viven en {@link ManagementController}
 *  y los endpoints de diagnóstico interno en {@link StoreDiagnosticsController}. */
@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreDetailService storeDetailService;
    private final StoreRepository storeRepository;
    private final SessionContext sessionContext;

    @GetMapping
    public ResponseEntity<List<StoreViewDto>> getStores(@RequestParam(required = false) String q) {
        List<StoreViewDto> stores = (q != null && !q.isBlank())
                ? storeDetailService.searchStores(q)
                : storeDetailService.getActiveStores();
        return ResponseEntity.ok(stores);
    }

    /** Búsqueda global cross-cartera para Follow Up — devuelve datos clave de cualquier tienda cargada. */
    @GetMapping("/global-search")
    public ResponseEntity<List<GlobalStoreResult>> globalSearch(@RequestParam(required = false, defaultValue = "") String q) {
        List<com.rappi.farmer.domain.entities.Store> stores = q.isBlank()
                ? List.of()
                : storeRepository.searchByCodeOrName(q);
        List<GlobalStoreResult> result = stores.stream()
                .map(s -> new GlobalStoreResult(
                        s.getId(), s.getStoreCode(), s.getStoreName(), s.getBrandId(),
                        s.getPhoneNumber(), s.getFarmerEmail(), s.getLastFollowUp(), s.getActive()))
                .toList();
        return ResponseEntity.ok(result);
    }

    public record GlobalStoreResult(
            Long id, String storeCode, String storeName, String brandId,
            String phoneNumber, String farmerEmail, java.time.LocalDate lastFollowUp, Boolean active) {}

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
            case "ACTIVE"     -> storeDetailService.toViewDtos(storeRepository.findActive7DaysWithSuccessfulManagement(farmerIds));
            case "ACTIVE_28"  -> storeDetailService.toViewDtos(storeRepository.findActive8to28DaysWithSuccessfulManagement(farmerIds));
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

    /** Detalle compacto de una tienda por storeCode — usado por el asistente IA. Requiere Map.ofEntries (>10 pares). */
    @GetMapping("/by-code/{storeCode}")
    public ResponseEntity<?> getByCode(@PathVariable String storeCode) {
        var opt = storeRepository.findByStoreCode(storeCode);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        var s = opt.get();
        var detail = Map.ofEntries(
                Map.entry("id",             s.getId() != null ? String.valueOf(s.getId()) : ""),
                Map.entry("storeCode",      s.getStoreCode() != null ? s.getStoreCode() : ""),
                Map.entry("brandId",        s.getBrandId() != null ? s.getBrandId() : "—"),
                Map.entry("storeName",      s.getStoreName() != null ? s.getStoreName() : ""),
                Map.entry("phoneNumber",    s.getPhoneNumber() != null ? s.getPhoneNumber() : "—"),
                Map.entry("channel",        s.getChannel() != null ? s.getChannel() : "—"),
                Map.entry("aging",          s.getAging() != null ? String.valueOf(s.getAging()) : "0"),
                Map.entry("agingStage",     s.getAgingStage() != null ? s.getAgingStage() : "—"),
                Map.entry("currentStatus",  s.getCurrentStatus() != null ? s.getCurrentStatus() : "—"),
                Map.entry("hadHandoff",     Boolean.TRUE.equals(s.getHadHandoff()) ? "true" : "false"),
                Map.entry("connectionPct",  s.getConnectionPercentage() != null ? s.getConnectionPercentage().toPlainString() : "—"),
                Map.entry("onboardingDate", s.getOnboardingDate() != null ? s.getOnboardingDate().toString() : "—"),
                Map.entry("lastFollowUp",   s.getLastFollowUp() != null ? s.getLastFollowUp().toString() : "—"),
                Map.entry("followUpLast30d",s.getFollowUpLast30d() != null ? s.getFollowUpLast30d() : "—"),
                Map.entry("gestionar",      s.getGestionar() != null ? s.getGestionar() : "—")
        );
        return ResponseEntity.ok(detail);
    }

    @PatchMapping("/{id}/phone")
    public ResponseEntity<?> updatePhone(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String phone = body.getOrDefault("phoneNumber", "").trim();
        if (phone.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "Teléfono vacío"));
        return storeRepository.findById(id).map(store -> {
            if (!isAdminOrLider() && !sessionContext.getCurrentUserId().equals(store.getFarmerId())) {
                return ResponseEntity.status(403).body(Map.of("message", "No puedes editar una tienda que no es tuya"));
            }
            store.setPhoneNumber(phone);
            storeRepository.save(store);
            return ResponseEntity.ok(Map.of("id", id, "phoneNumber", phone));
        }).orElse(ResponseEntity.notFound().build());
    }

    private boolean isAdminOrLider() {
        UserRole role = sessionContext.getCurrentUserRole();
        return role == UserRole.ADMIN || role == UserRole.LIDER;
    }
}
