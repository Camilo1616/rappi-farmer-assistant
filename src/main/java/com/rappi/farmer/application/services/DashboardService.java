package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.DashboardDataDto;
import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.domain.entities.DailyMetric;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Clasifica las tiendas activas en 5 secciones de prioridad para el dashboard.
 *
 * Reglas (en orden de evaluación):
 *  1. Onboarding crítico  — días 1-8 y sin órdenes aún
 *  2. Conexión Aliados    — días 8-14 y AVA < 60%
 *  3. Riesgo Churn        — estado M1, M2 o churn
 *  4. AVA bajando         — > 14 días y conexión < 60%
 *  5. Saludables          — todo lo demás
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final BigDecimal ALIADOS_THRESHOLD = BigDecimal.valueOf(60);
    private static final int MAX_PER_SECTION = 20;

    private final StoreRepository storeRepository;
    private final DailyMetricRepository dailyMetricRepository;
    private final ManagementRepository managementRepository;

    public DashboardDataDto load() {
        LocalDate today = LocalDate.now();

        List<Store> stores = storeRepository.findActive();

        Map<Long, DailyMetric> metricsMap = dailyMetricRepository
                .findByDate(today)
                .stream()
                .collect(Collectors.toMap(DailyMetric::getStoreId, m -> m));

        // Mapa storeId → resultado de la primera gestión registrada hoy
        Map<Long, String> todayManagementsMap = managementRepository
                .findAllToday()
                .stream()
                .collect(Collectors.toMap(
                        Management::getStoreId,
                        Management::getResultType,
                        (existing, replacement) -> existing  // conserva la primera (más reciente por ORDER BY)
                ));

        List<StoreViewDto> onboardingCritical = new ArrayList<>();
        List<StoreViewDto> aliados = new ArrayList<>();
        List<StoreViewDto> churnRisk = new ArrayList<>();
        List<StoreViewDto> avaDropping = new ArrayList<>();
        List<StoreViewDto> healthy = new ArrayList<>();
        List<StoreViewDto> avaLow = new ArrayList<>();

        for (Store store : stores) {
            DailyMetric metric = metricsMap.get(store.getId());
            int aging = calcAging(store.getOnboardingDate());
            StoreViewDto dto = toViewDto(store, metric, aging, todayManagementsMap.get(store.getId()));

            // AVA < 10% — se evalúa independientemente de las otras secciones
            if (isCriticallyLowAva(metric, store)) {
                avaLow.add(dto);
            }

            if (aging >= 1 && aging <= 8 && hasNoOrders(metric) && isOnboardingEligible(store)) {
                onboardingCritical.add(dto);
            } else if (aging > 8 && aging <= 14 && isLowConnection(metric, store)) {
                aliados.add(dto);
            } else if (isChurnRisk(store)) {
                churnRisk.add(dto);
            } else if (aging > 14 && isLowConnection(metric, store)) {
                avaDropping.add(dto);
            } else {
                healthy.add(dto);
            }
        }

        log.info("Dashboard cargado — onboarding:{}, aliados:{}, churn:{}, ava:{}, sanos:{}, avaLow:{}",
                onboardingCritical.size(), aliados.size(), churnRisk.size(),
                avaDropping.size(), healthy.size(), avaLow.size());

        return new DashboardDataDto(
                cap(onboardingCritical), cap(aliados),
                churnRisk,    // todas
                avaDropping,  // todas
                healthy,      // todas
                avaLow,       // todas
                onboardingCritical.size(), aliados.size(), churnRisk.size(),
                avaDropping.size(), healthy.size(), avaLow.size()
        );
    }

    private int calcAging(LocalDate onboardingDate) {
        if (onboardingDate == null) return 0;
        return (int) ChronoUnit.DAYS.between(onboardingDate, LocalDate.now());
    }

    private boolean hasNoOrders(DailyMetric metric) {
        return metric == null
                || metric.getOrdersCount() == null
                || metric.getOrdersCount() == 0;
    }

    private boolean isLowConnection(DailyMetric metric, Store store) {
        BigDecimal pct = metric != null && metric.getConnectionPercentage() != null
                ? metric.getConnectionPercentage()
                : store.getConnectionPercentage();
        return pct == null || pct.compareTo(ALIADOS_THRESHOLD) < 0;
    }

    /**
     * Hunting e Inside Sales: solo entran a onboarding si tuvieron handoff (TUVO_HANDOFF = SI).
     * Self (se registra solo): siempre entra a onboarding sin importar el handoff.
     */
    private boolean isOnboardingEligible(Store store) {
        String channel = store.getChannel();
        if (channel == null) return true;
        String c = channel.toLowerCase().trim();
        if (c.contains("hunting") || c.contains("inside")) {
            return Boolean.TRUE.equals(store.getHadHandoff());
        }
        return true;
    }

    private boolean isCriticallyLowAva(DailyMetric metric, Store store) {
        BigDecimal pct = metric != null && metric.getConnectionPercentage() != null
                ? metric.getConnectionPercentage()
                : store.getConnectionPercentage();
        if (pct == null) return false;
        return pct.compareTo(BigDecimal.ONE) > 0 && pct.compareTo(BigDecimal.valueOf(15)) < 0;
    }

    private boolean isChurnRisk(Store store) {
        if (store.getCurrentStatus() == null) return false;
        String s = store.getCurrentStatus().toLowerCase();
        return s.contains("m1") || s.contains("m2") || s.contains("churn");
    }

    private List<StoreViewDto> cap(List<StoreViewDto> list) {
        return list.size() <= MAX_PER_SECTION ? list : list.subList(0, MAX_PER_SECTION);
    }

    private StoreViewDto toViewDto(Store store, DailyMetric metric, int aging, String managementResult) {
        Integer orders = metric != null ? metric.getOrdersCount() : null;
        BigDecimal connection = metric != null && metric.getConnectionPercentage() != null
                ? metric.getConnectionPercentage()
                : store.getConnectionPercentage();

        return new StoreViewDto(
                store.getId(),
                store.getStoreCode(),
                store.getStoreName(),
                store.getPhoneNumber(),
                aging,
                orders,
                connection,
                store.getCurrentStatus(),
                calcTendencia(metric),
                managementResult
        );
    }

    /**
     * Compara AVA_L7D (últimos 7 días) vs AVA_L4W (últimas 4 semanas).
     * Si los últimos 7 días son significativamente mejores → Subiendo.
     * Si son peores → Bajando. Diferencia <= 5 puntos → Estable.
     */
    private String calcTendencia(DailyMetric metric) {
        if (metric == null) return "-";
        BigDecimal l4w = metric.getConnectionPercentage();
        BigDecimal l7d = metric.getAvaL7d();
        if (l4w == null || l7d == null) return "-";

        double diff = l7d.doubleValue() - l4w.doubleValue();
        if (diff > 5)  return "Subiendo";
        if (diff < -5) return "Bajando";
        return "Estable";
    }
}
