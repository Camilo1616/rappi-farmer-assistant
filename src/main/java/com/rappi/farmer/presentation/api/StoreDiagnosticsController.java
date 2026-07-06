package com.rappi.farmer.presentation.api;

import com.rappi.farmer.domain.repositories.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Endpoints internos de diagnóstico de cartera — solo ADMIN/LIDER. */
@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','LIDER')")
public class StoreDiagnosticsController {

    private final StoreRepository storeRepository;

    /** Diagnóstico: cuántas tiendas pasan cada filtro de la base ACTIVE/ACTIVE_28 */
    @GetMapping("/debug-base")
    public ResponseEntity<?> debugBase(@RequestParam List<Long> farmerIds) {
        var jpa = ((com.rappi.farmer.infrastructure.persistence.adapter.StoreRepositoryAdapter)
            storeRepository).getJpa();
        long total       = jpa.countDebugTotal(farmerIds);
        long handoff     = jpa.countDebugHandoff(farmerIds);
        long fecha7      = jpa.countDebugFecha7(farmerIds);
        long fecha8a28   = jpa.countDebugFecha8a28(farmerIds);
        long efectiva    = jpa.countDebugEfectiva(farmerIds);
        long sinVentas   = jpa.countDebugSinVentas(farmerIds);
        long final7      = jpa.countDebugFinal7(farmerIds);
        long final8a28   = jpa.countDebugFinal8a28(farmerIds);
        return ResponseEntity.ok(Map.of(
            "1_activas_en_farmers",      total,
            "2_con_handoff",             handoff,
            "3a_onboarding_dia7",        fecha7,
            "3b_onboarding_dias8a28",    fecha8a28,
            "4_con_gestion_efectiva",    efectiva,
            "5_sin_ventas_en_metrics",   sinVentas,
            "FINAL_active7",             final7,
            "FINAL_active8a28",          final8a28
        ));
    }

    /** Diagnóstico: estado de tiendas específicas por código (activa, upload_date, follow_up, etc.) */
    @GetMapping("/debug-codes")
    public ResponseEntity<?> debugCodes(@RequestParam List<String> codes) {
        var jpa = ((com.rappi.farmer.infrastructure.persistence.adapter.StoreRepositoryAdapter)
            storeRepository).getJpa();
        List<Map<String, Object>> result = codes.stream()
            .map(code -> {
                var opt = jpa.findFirstByStoreCode(code);
                if (opt.isEmpty()) return Map.<String, Object>of("code", code, "found", false);
                var s = opt.get();
                return Map.<String, Object>of(
                    "code",           code,
                    "found",          true,
                    "active",         s.getActive(),
                    "userId",         s.getUser() != null ? s.getUser().getId() : null,
                    "channel",        s.getChannel(),
                    "hadHandoff",     s.getHadHandoff(),
                    "uploadDate",     String.valueOf(s.getUploadDate()),
                    "lastFollowUp",   String.valueOf(s.getLastFollowUp()),
                    "followUp30d",    String.valueOf(s.getFollowUpLast30d())
                );
            }).toList();
        return ResponseEntity.ok(result);
    }
}
