package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.dtos.DashboardDataDto;
import com.rappi.farmer.application.dtos.FarmerSummaryDto;
import com.rappi.farmer.application.dtos.LiderDashboardDto;
import com.rappi.farmer.application.services.AdminService;
import com.rappi.farmer.application.services.DashboardService;
import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.infrastructure.persistence.repository.BaseAssignmentJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.BaseJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final AdminService adminService;
    private final SessionContext sessionContext;
    private final BaseJpaRepository baseRepo;
    private final BaseAssignmentJpaRepository assignmentRepo;

    @GetMapping
    public ResponseEntity<DashboardDataDto> getDashboard() {
        return ResponseEntity.ok(dashboardService.load());
    }

    @GetMapping("/lider")
    public ResponseEntity<LiderDashboardDto> getLiderDashboard() {
        List<FarmerSummaryDto> farmers = adminService.getAllFarmers();

        long totalGestiones  = farmers.stream().mapToLong(FarmerSummaryDto::getGestionesHoy).sum();
        long totalEfectivas  = farmers.stream().mapToLong(FarmerSummaryDto::getExitosasHoy).sum();
        long totalNoContacto = farmers.stream().mapToLong(FarmerSummaryDto::getNoContactoHoy).sum();
        long totalStores     = farmers.stream().mapToLong(FarmerSummaryDto::getTotalStores).sum();
        long totalOnboarding = farmers.stream().mapToLong(FarmerSummaryDto::getOnboardingCount).sum();
        long totalChurn      = farmers.stream().mapToLong(FarmerSummaryDto::getChurnCount).sum();
        long totalSaludables = farmers.stream().mapToLong(FarmerSummaryDto::getSaludablesCount).sum();

        Long liderId = sessionContext.getCurrentUserId();
        long basesPendientes  = 0, basesEnProceso = 0, basesCompletadas = 0;
        if (liderId != null) {
            var bases = baseRepo.findByLiderIdOrderByCreatedAtDesc(liderId);
            for (var base : bases) {
                var assignments = assignmentRepo.findByBaseId(base.getId());
                boolean allDone  = !assignments.isEmpty() && assignments.stream().allMatch(a -> "COMPLETADO".equals(a.getStatus()));
                boolean anyProc  = assignments.stream().anyMatch(a -> "EN_PROCESO".equals(a.getStatus()) || "LEIDA".equals(a.getStatus()));
                if (allDone)       basesCompletadas++;
                else if (anyProc)  basesEnProceso++;
                else               basesPendientes++;
            }
        }

        return ResponseEntity.ok(new LiderDashboardDto(
                farmers,
                totalGestiones, totalEfectivas, totalNoContacto,
                totalStores, totalOnboarding, totalChurn, totalSaludables,
                basesPendientes, basesEnProceso, basesCompletadas
        ));
    }
}
