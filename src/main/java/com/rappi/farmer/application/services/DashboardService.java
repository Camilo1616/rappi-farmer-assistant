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
import com.rappi.farmer.domain.repositories.UserRepository;
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
    private final UserRepository userRepository;
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

        List<DailyMetric> metrics = dailyMetricRepository.findByDate(today);
        if (metrics.isEmpty()) {
            LocalDate latestDate = dailyMetricRepository.findLatestDate().orElse(today);
            metrics = dailyMetricRepository.findByDate(latestDate);
            log.info("No hay métricas para hoy ({}), usando fecha más reciente: {}", today, latestDate);
        }
        Map<Long, DailyMetric> metricsMap = metrics.stream()
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
        List<StoreViewDto> aliados            = new ArrayList<>();
        List<StoreViewDto> churnRisk          = new ArrayList<>();
        List<StoreViewDto> ava                = new ArrayList<>();
        List<StoreViewDto> healthy            = new ArrayList<>();
        List<StoreViewDto> selfOnboarding     = new ArrayList<>();

        for (Store store : stores) {
            DailyMetric metric = metricsMap.get(store.getId());
            int aging = calcAgingEfectivo(store);
            StoreViewDto dto = toViewDto(store, metric, aging, todayManagementsMap.get(store.getId()));
            boolean isSelf = store.getChannel() != null
                    && store.getChannel().toLowerCase().contains("self");

            if (isSelf) {
                selfOnboarding.add(dto);
            } else if (aging >= 1 && aging <= 8) {
                onboardingCritical.add(dto);
            } else if (aging > 8 && aging <= 14) {
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

        log.info("Dashboard cargado — onboarding:{}, aliados:{}, churn:{}, ava:{}, sanos:{}, self:{}, recomendado:{}",
                onboardingCritical.size(), aliados.size(), churnRisk.size(),
                ava.size(), healthy.size(), selfOnboarding.size(), recommended.size());

        java.time.LocalDate lastImport = null;
        if (userId != null) {
            lastImport = userRepository.findById(userId)
                    .map(u -> u.getLastImportDate()).orElse(null);
        }
        boolean needsRefresh = lastImport == null || lastImport.isBefore(today);

        return new DashboardDataDto(
                cap(onboardingCritical), cap(aliados),
                churnRisk, ava, healthy, recommended,
                selfOnboarding,
                onboardingCritical.size(), aliados.size(), churnRisk.size(),
                ava.size(), healthy.size(), recommended.size(),
                stores.size(),
                selfOnboarding.size(),
                needsRefresh, lastImport
        );
    }

    /** Retorna las tiendas de un farmer clasificadas según el tipo de base, usando los mismos filtros del dashboard. */
    public List<Store> getStoresForBase(Long farmerId, String baseType) {
        List<Store> stores = storeRepository.findActiveByUser(farmerId);
        LocalDate now = LocalDate.now();
        List<DailyMetric> baseMetrics = dailyMetricRepository.findByDate(now);
        if (baseMetrics.isEmpty()) {
            now = dailyMetricRepository.findLatestDate().orElse(now);
            baseMetrics = dailyMetricRepository.findByDate(now);
        }
        Map<Long, DailyMetric> metricsMap = baseMetrics.stream()
                .collect(Collectors.toMap(DailyMetric::getStoreId, m -> m, (a, b) -> a));

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
        return toPercent(metric.getAvaMtd()).compareTo(BigDecimal.valueOf(60)) >= 0;
    }

    /**
     * Crítico: AVA_MTD 1%–15%.
     * Bajando: AVA_MTD > 15% y < 60%.
     * 0% → va a Churn, no a AVA.
     */
    private String resolveAvaLabel(DailyMetric metric) {
        if (metric == null) return null;
        BigDecimal mtd = metric.getAvaMtd();
        if (mtd == null) return null;
        BigDecimal pct = toPercent(mtd);
        if (pct.compareTo(BigDecimal.ZERO) > 0 && pct.compareTo(BigDecimal.valueOf(15)) <= 0) return "Crítico";
        if (pct.compareTo(BigDecimal.valueOf(15)) > 0 && pct.compareTo(BigDecimal.valueOf(60)) < 0) return "Bajando";
        return null;
    }

    /** Normaliza avaMtd: si está en escala 0-1 (decimal), convierte a 0-100 (porcentaje). */
    private BigDecimal toPercent(BigDecimal val) {
        if (val == null) return BigDecimal.ZERO;
        return val.compareTo(BigDecimal.ONE) <= 0
                ? val.multiply(BigDecimal.valueOf(100))
                : val;
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
        // Buscar en currentStatus (col "Estado Churn AVA") y en gestionar (col "GESTIONAR")
        // Se revisan los DOS — el primero que haga match gana
        String label = detectChurnLabel(store.getCurrentStatus());
        if (label == null) label = detectChurnLabel(store.getGestionar());
        if (label == null) return null;

        // Sin fecha de login → no incluir
        if (store.getLastLoginDate() == null) return null;
        // Más de 90 días sin login → no incluir
        long dias = ChronoUnit.DAYS.between(store.getLastLoginDate(), LocalDate.now());
        if (dias > 90) return null;
        return label;
    }

    /** Extrae la etiqueta de churn de un texto, o null si no hay match. */
    private static String detectChurnLabel(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String up = raw.trim().toUpperCase();
        if (up.equals("CHURN") || up.startsWith("CHURN:") || up.startsWith("MAX RISK")) return "Churn";
        if (up.contains("PREVENTION W1") || up.contains("PREVENTION 1W")) return "Prevention W1";
        if (up.contains("PREVENTION W2") || up.contains("PREVENTION 2W")) return "Prevention W2";
        if (up.contains("PREVENTION W3") || up.contains("PREVENTION 3W")) return "Prevention W3";
        return null;
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
                store.getBrandId(),
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
                store.getFarmerEmail(),
                metric != null ? toPercent(metric.getAvaMtd()) : null,
                metric != null ? toPercent(metric.getConnectionPercentage()) : null,
                metric != null ? toPercent(metric.getAvaL7d()) : null,
                null,
                null,
                store.getChannel()
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
     * Arma la lista "Recomendado Hoy" usando puntaje de urgencia.
     *
     * Onboarding 1-8 y Aliados 8-14 se mantienen como bloque fijo al inicio
     * (columna AVA de esas tiendas pendiente de implementar).
     *
     * Churn y AVA se ordenan por puntaje descendente:
     *   - Churn/Max Risk +90, Prevention W1 +75, W2 +55, W3 +35
     *   - AVA ≤15% +60, 15-30% +35, 30-60% +15
     *   - Sin gestión hoy: puntaje base + 25
     *   - Ya gestionada hoy: puntaje base × 0.3 (baja al fondo)
     *
     * Total máximo: 40 tiendas.
     */
    private List<StoreViewDto> buildRecommended(
            List<StoreViewDto> onboarding,
            List<StoreViewDto> aliados,
            List<StoreViewDto> churnRisk,
            List<StoreViewDto> ava,
            Map<Long, DailyMetric> metricsMap) {

        List<StoreViewDto> result = new ArrayList<>();
        java.util.Set<Long> seen = new java.util.HashSet<>();

        // Onboarding y aliados: bloque fijo, datos de AVA pendientes
        for (StoreViewDto s : onboarding) {
            if (seen.add(s.getId())) result.add(withSegmento(s, "Onboarding 1-8"));
        }
        for (StoreViewDto s : aliados) {
            if (seen.add(s.getId())) result.add(withSegmento(s, "Aliados <60%"));
        }

        // Churn + AVA: puntaje de urgencia
        record Scored(StoreViewDto store, int score, String segmento) {}
        List<Scored> scored = new ArrayList<>();

        for (StoreViewDto s : churnRisk) {
            int base = scoreChurn(s);
            scored.add(new Scored(s, applyManagementFactor(base, s),
                    s.getChurnLabel() != null ? s.getChurnLabel() : "Churn"));
        }
        for (StoreViewDto s : ava) {
            if (seen.contains(s.getId())) continue;
            int base = scoreAva(s);
            String label = "AVA " + (s.getAvaLabel() != null ? s.getAvaLabel() : "");
            scored.add(new Scored(s, applyManagementFactor(base, s), label.trim()));
        }

        scored.sort((a, b) -> Integer.compare(b.score(), a.score()));

        for (Scored sc : scored) {
            if (result.size() >= 40) break;
            if (seen.add(sc.store().getId())) {
                result.add(withSegmento(sc.store(), sc.segmento()));
            }
        }

        return result;
    }

    /** Puntaje base por etiqueta de churn. */
    private int scoreChurn(StoreViewDto s) {
        if (s.getChurnLabel() == null) return 0;
        return switch (s.getChurnLabel()) {
            case "Churn"          -> 90;
            case "Prevention W1"  -> 75;
            case "Prevention W2"  -> 55;
            case "Prevention W3"  -> 35;
            default               -> 40;
        };
    }

    /** Puntaje base por AVA MTD (avaMtd ya viene en escala 0-100 desde toViewDto). */
    private int scoreAva(StoreViewDto s) {
        if (s.getAvaMtd() == null) return 0;
        double pct = s.getAvaMtd().doubleValue();
        if (pct > 0  && pct <= 15) return 60;
        if (pct > 15 && pct <= 30) return 35;
        if (pct > 30 && pct <  60) return 15;
        return 0;
    }

    /**
     * Sin gestión hoy → base + 25 (bonus de urgencia).
     * Ya gestionada hoy → base × 0.3 (baja al fondo pero no desaparece).
     */
    private int applyManagementFactor(int base, StoreViewDto s) {
        if (s.getTodayManagementResult() == null) return base + 25;
        return (int) (base * 0.3);
    }

    private StoreViewDto withSegmento(StoreViewDto original, String segmento) {
        return new StoreViewDto(
                original.getId(), original.getStoreCode(), original.getBrandId(), original.getStoreName(),
                original.getPhoneNumber(), original.getAging(), original.getOrdersL4W(),
                original.getConnectionPercentage(), original.getCurrentStatus(),
                original.getTendencia(), original.getTodayManagementResult(), segmento,
                original.getHadHandoff(), original.getLastLoginDate(), original.getDiasSinLogin(),
                original.getAgingStage(), original.getChurnLabel(), original.getAvaLabel(),
                original.getFarmerEmail(), original.getAvaMtd(), original.getAvaL4w(), original.getAvaL7d(),
                original.getDashboardSegment(), original.getLastContact(), original.getChannel());
    }
}
