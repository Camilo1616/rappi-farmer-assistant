package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class LiderDashboardDto {
    private List<FarmerSummaryDto> farmers;
    // Totales del equipo hoy
    private long totalGestiones;
    private long totalEfectivas;
    private long totalNoContacto;
    // Cartera del equipo
    private long totalStores;
    private long totalOnboarding;
    private long totalChurn;
    private long totalSaludables;
    // Bases
    private long basesPendientes;
    private long basesEnProceso;
    private long basesCompletadas;
}
