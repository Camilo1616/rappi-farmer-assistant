package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@AllArgsConstructor
public class DashboardDataDto {
    private List<StoreViewDto> onboardingCritical;
    private List<StoreViewDto> aliados;
    private List<StoreViewDto> churnRisk;
    private List<StoreViewDto> ava;
    private List<StoreViewDto> healthy;
    private List<StoreViewDto> recommended;

    private int onboardingCount;
    private int aliadosCount;
    private int churnCount;
    private int avaCount;
    private int healthyCount;
    private int recommendedCount;

    /** Todas las tiendas activas combinadas (para la tabla de WhatsApp). */
    public List<StoreViewDto> allStores() {
        List<StoreViewDto> all = new ArrayList<>();
        all.addAll(onboardingCritical);
        all.addAll(aliados);
        all.addAll(churnRisk);
        all.addAll(ava);
        all.addAll(healthy);
        return all;
    }
}
