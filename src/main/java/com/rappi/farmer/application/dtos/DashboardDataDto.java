package com.rappi.farmer.application.dtos;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DashboardDataDto {
    private List<StoreViewDto> onboardingCritical;
    private List<StoreViewDto> aliados;
    private List<StoreViewDto> churnRisk;
    private List<StoreViewDto> ava;
    private List<StoreViewDto> healthy;
    private List<StoreViewDto> recommended;
    private List<StoreViewDto> selfOnboarding;
    private List<StoreViewDto> insideSales;
    private List<StoreViewDto> recontactosW2;

    private int onboardingCount;
    private int aliadosCount;
    private int churnCount;
    private int avaCount;
    private int healthyCount;
    private int recommendedCount;
    private int totalCount;
    private int selfOnboardingCount;
    private int insideSalesCount;
    private int recontactosW2Count;

    private boolean needsRefresh;
    private LocalDate lastImportDate;

    /** Todas las tiendas activas combinadas (para la tabla de WhatsApp). */
    public List<StoreViewDto> allStores() {
        List<StoreViewDto> all = new ArrayList<>();
        all.addAll(onboardingCritical);
        all.addAll(aliados);
        all.addAll(churnRisk);
        all.addAll(ava);
        all.addAll(healthy);
        all.addAll(selfOnboarding);
        return all;
    }
}
