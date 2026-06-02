package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.DashboardDataDto;
import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.domain.entities.DailyMetric;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.application.SessionContext;
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
    private static final int MAX_PER_SECTION = 30;

    private final StoreRepository storeRepository;
    private final DailyMetricRepository dailyMetricRepository;
    private final ManagementRepository managementRepository;
    private final SessionContext sessionContext;

    public DashboardDataDto load() {
        LocalDate today = LocalDate.now();
        Long userId = sessionContext.getCurrentUserId();

        List<Store> stores;
        if (userId != null) {
            boolean isLider = sessionContext.getCurrentUserRole() != null
                    && com.rappi.farmer.domain.enums.UserRole.LIDER == sessionContext.getCurrentUserRole();
            if (isLider) {
                stores = storeRepository.findActive();
            } else {
                stores = storeRepository.findActiveByUser(userId);
                log.info("Dashboard — userId:{} tiendas:{}", userId, stores.size());
            }
        } else {
            stores = storeRepository.findActive();
        }

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
            int aging = store.getAging() != null ? store.getAging() : calcAging(store.getOnboardingDate());
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

        List<StoreViewDto> recommended = buildRecommended(
                onboardingCritical, aliados, churnRisk, avaLow, metricsMap);

        log.info("Dashboard cargado — onboarding:{}, aliados:{}, churn:{}, ava:{}, sanos:{}, avaLow:{}, recomendado:{}",
                onboardingCritical.size(), aliados.size(), churnRisk.size(),
                avaDropping.size(), healthy.size(), avaLow.size(), recommended.size());

        return new DashboardDataDto(
                cap(onboardingCritical), cap(aliados),
                churnRisk,
                avaDropping,
                healthy,
                avaLow,
                recommended,
                onboardingCritical.size(), aliados.size(), churnRisk.size(),
                avaDropping.size(), healthy.size(), avaLow.size(), recommended.size()
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
                managementResult,
                null,
                store.getHadHandoff()
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

    /**
     * Arma la lista "Recomendado Hoy":
     *  - Todas las tiendas onboarding 1-8 sin primera orden
     *  - Todas las tiendas aliados 8-14 con AVA < 60%
     *  - Hasta 5 churn M1 sin login en Rappi Aliados (rappiAlliesConnected = false/null)
     *  - Hasta 10 tiendas AVA 1-15%
     * Cada DTO lleva el campo segmento para mostrarlo en la tabla.
     */
    private List<StoreViewDto> buildRecommended(
            List<StoreViewDto> onboarding,
            List<StoreViewDto> aliados,
            List<StoreViewDto> churnRisk,
            List<StoreViewDto> avaLow,
            Map<Long, DailyMetric> metricsMap) {

        List<StoreViewDto> result = new ArrayList<>();
        // Tracked por id para evitar duplicados (una tienda puede estar en avaLow Y onboarding/aliados)
        java.util.Set<Long> seen = new java.util.HashSet<>();

        for (StoreViewDto s : onboarding) {
            if (seen.add(s.getId())) result.add(withSegmento(s, "Onboarding 1-8"));
        }
        for (StoreViewDto s : aliados) {
            if (seen.add(s.getId())) result.add(withSegmento(s, "Aliados <60%"));
        }

        churnRisk.stream().limit(5).forEach(s -> {
            if (seen.add(s.getId())) {
                String status = s.getCurrentStatus() != null
                        ? s.getCurrentStatus().toUpperCase() : "CHURN";
                String label = status.contains("M1") ? "Churn M1"
                             : status.contains("M2") ? "Churn M2"
                             : "Churn";
                result.add(withSegmento(s, label));
            }
        });

        avaLow.stream().limit(15).forEach(s -> {
            if (seen.add(s.getId())) result.add(withSegmento(s, "AVA 1-15%"));
        });

        return result;
    }

    private StoreViewDto withSegmento(StoreViewDto original, String segmento) {
        return new StoreViewDto(
                original.getId(), original.getStoreCode(), original.getStoreName(),
                original.getPhoneNumber(), original.getAging(), original.getOrdersL4W(),
                original.getConnectionPercentage(), original.getCurrentStatus(),
                original.getTendencia(), original.getTodayManagementResult(), segmento,
                original.getHadHandoff());
    }
}
