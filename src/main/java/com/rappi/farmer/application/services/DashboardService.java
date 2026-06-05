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
        List<StoreViewDto> ava = new ArrayList<>();

        for (Store store : stores) {
            DailyMetric metric = metricsMap.get(store.getId());
            int aging = calcAgingEfectivo(store);
            StoreViewDto dto = toViewDto(store, metric, aging, todayManagementsMap.get(store.getId()));

            boolean isSelf = store.getChannel() != null
                    && store.getChannel().toLowerCase().contains("self");

            if (!isSelf && aging >= 1 && aging <= 8) {
                onboardingCritical.add(dto);
            } else if (!isSelf && aging > 8 && aging <= 14) {
                aliados.add(dto);
            } else if (isChurnRisk(metric, store)) {
                churnRisk.add(dto);
            } else if (resolveAvaLabel(metric) != null) {
                ava.add(dto);
            } else if (isHealthy(metric)) {
                healthy.add(dto);
            }
        }

        List<StoreViewDto> recommended = buildRecommended(
                onboardingCritical, aliados, churnRisk, ava, metricsMap);

        log.info("Dashboard cargado — onboarding:{}, aliados:{}, churn:{}, ava:{}, sanos:{}, recomendado:{}",
                onboardingCritical.size(), aliados.size(), churnRisk.size(),
                ava.size(), healthy.size(), recommended.size());

        return new DashboardDataDto(
                cap(onboardingCritical), cap(aliados),
                churnRisk,
                ava,
                healthy,
                recommended,
                onboardingCritical.size(), aliados.size(), churnRisk.size(),
                ava.size(), healthy.size(), recommended.size()
        );
    }

    /** Retorna las tiendas de un farmer clasificadas según el tipo de base, usando los mismos filtros del dashboard. */
    public List<Store> getStoresForBase(Long farmerId, String baseType) {
        List<Store> stores = storeRepository.findActiveByUser(farmerId);
        Map<Long, DailyMetric> metricsMap = dailyMetricRepository.findByDate(LocalDate.now())
                .stream().collect(Collectors.toMap(DailyMetric::getStoreId, m -> m, (a, b) -> a));

        return stores.stream().filter(store -> {
            DailyMetric metric = metricsMap.get(store.getId());
            int aging = calcAgingEfectivo(store);
            boolean isSelf = store.getChannel() != null
                    && store.getChannel().toLowerCase().contains("self");
            return switch (baseType) {
                case "ACTIVE_F7D" -> !isSelf && aging >= 1 && aging <= 8;
                case "AVA_8_14"   -> !isSelf && aging > 8 && aging <= 14;
                case "CHURN"      -> isChurnRisk(metric, store);
                case "RETENCION"  -> resolveAvaLabel(metric) != null;
                default           -> true;
            };
        }).toList();
    }

    /**
     * Fuente de verdad para el aging:
     *  1. handoff_activated_at — fecha en que el HO fue confirmado (Hunting/Inside) o el onboarding empezó (Self)
     *  2. aging del Excel — valor estático de la última carga
     *  3. onboarding_date — cálculo desde la fecha de inicio
     */
    private int calcAgingEfectivo(Store store) {
        if (store.getHandoffActivatedAt() != null) {
            return (int) ChronoUnit.DAYS.between(store.getHandoffActivatedAt(), LocalDate.now());
        }
        if (store.getAging() != null) return store.getAging();
        return calcAging(store.getOnboardingDate());
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
        return pct != null && pct.compareTo(ALIADOS_THRESHOLD) < 0;
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

    /** Saludable: AVA_MTD >= 60%. */
    private boolean isHealthy(DailyMetric metric) {
        if (metric == null || metric.getAvaMtd() == null) return false;
        return metric.getAvaMtd().compareTo(BigDecimal.valueOf(60)) >= 0;
    }

    /** Devuelve "Churn Ava" (AVA_MTD 1–15%) o "Disminuye" (AVA STATUS), o null si no aplica. */
    private String resolveAvaLabel(DailyMetric metric) {
        if (metric == null) return null;
        // Crítico: AVA_MTD entre 1% y 15% (sin importar el avaStatus)
        BigDecimal mtd = metric.getAvaMtd();
        if (mtd != null
                && mtd.compareTo(BigDecimal.ONE) >= 0
                && mtd.compareTo(BigDecimal.valueOf(15)) < 0) {
            return "Churn Ava";
        }
        // Bajando: AVA STATUS = "Disminuye" y AVA_MTD entre 15% y 59.99%
        if (metric.getAvaStatus() != null
                && metric.getAvaStatus().trim().equalsIgnoreCase("Disminuye")
                && mtd != null
                && mtd.compareTo(BigDecimal.valueOf(15)) >= 0
                && mtd.compareTo(BigDecimal.valueOf(60)) < 0) {
            return "Disminuye";
        }
        return null;
    }

    /**
     * Churn: la columna "Estado Churn AVA" contiene "Churn", "Prevention W1/W2/W3"
     * y el último login fue hace ≤ 90 días (o no tiene fecha de login).
     */
    private boolean isChurnRisk(DailyMetric metric, Store store) {
        return resolveChurnLabel(store) != null;
    }

    /** Devuelve la etiqueta de churn o null si la tienda no está en riesgo. */
    private String resolveChurnLabel(Store store) {
        String status = store.getCurrentStatus();
        if (status == null) return null;
        String s = status.trim();
        boolean isChurnStatus = s.equalsIgnoreCase("Churn")
                || s.equalsIgnoreCase("Prevention W1")
                || s.equalsIgnoreCase("Prevention W2")
                || s.equalsIgnoreCase("Prevention W3");
        if (!isChurnStatus) return null;
        if (store.getLastLoginDate() == null) return null;
        long dias = ChronoUnit.DAYS.between(store.getLastLoginDate(), LocalDate.now());
        return dias <= 90 ? s : null;
    }

    private List<StoreViewDto> cap(List<StoreViewDto> list) {
        return list.size() <= MAX_PER_SECTION ? list : list.subList(0, MAX_PER_SECTION);
    }

    private StoreViewDto toViewDto(Store store, DailyMetric metric, int aging, String managementResult) {
        Integer orders = metric != null ? metric.getOrdersCount() : null;
        BigDecimal connection = metric != null && metric.getConnectionPercentage() != null
                ? metric.getConnectionPercentage()
                : store.getConnectionPercentage();

        Integer diasSinLogin = store.getLastLoginDate() != null
                ? (int) ChronoUnit.DAYS.between(store.getLastLoginDate(), LocalDate.now())
                : null;

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
                store.getHadHandoff(),
                store.getLastLoginDate(),
                diasSinLogin,
                store.getAgingStage(),
                resolveChurnLabel(store),
                resolveAvaLabel(metric),
                store.getFarmerEmail()
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
            List<StoreViewDto> ava,
            Map<Long, DailyMetric> metricsMap) {

        List<StoreViewDto> result = new ArrayList<>();
        java.util.Set<Long> seen = new java.util.HashSet<>();

        for (StoreViewDto s : onboarding) {
            if (seen.add(s.getId())) result.add(withSegmento(s, "Onboarding 1-8"));
        }
        for (StoreViewDto s : aliados) {
            if (seen.add(s.getId())) result.add(withSegmento(s, "Aliados <60%"));
        }
        churnRisk.stream().limit(5).forEach(s -> {
            if (seen.add(s.getId())) {
                String label = s.getChurnLabel() != null ? s.getChurnLabel() : "Churn";
                result.add(withSegmento(s, label));
            }
        });
        ava.stream()
            .filter(s -> "Churn Ava".equalsIgnoreCase(s.getAvaLabel()))
            .limit(10)
            .forEach(s -> { if (seen.add(s.getId())) result.add(withSegmento(s, "AVA Crítico")); });

        return result;
    }

    private StoreViewDto withSegmento(StoreViewDto original, String segmento) {
        return new StoreViewDto(
                original.getId(), original.getStoreCode(), original.getStoreName(),
                original.getPhoneNumber(), original.getAging(), original.getOrdersL4W(),
                original.getConnectionPercentage(), original.getCurrentStatus(),
                original.getTendencia(), original.getTodayManagementResult(), segmento,
                original.getHadHandoff(), original.getLastLoginDate(), original.getDiasSinLogin(),
                original.getAgingStage(), original.getChurnLabel(), original.getAvaLabel(),
                original.getFarmerEmail());
    }
}
