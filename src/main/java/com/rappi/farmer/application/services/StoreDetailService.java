package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.domain.entities.DailyMetric;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Servicio de consulta para el diálogo de detalle de tienda.
 * Centraliza las búsquedas que antes estaban directamente en MainController.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StoreDetailService {

    private final StoreRepository storeRepository;
    private final DailyMetricRepository dailyMetricRepository;
    private final ManagementRepository managementRepository;
    private final SessionContext sessionContext;

    public List<StoreViewDto> getActiveStores() {
        Long userId = sessionContext.getCurrentUserId();
        List<Store> stores = userId != null
                ? storeRepository.findActiveByUser(userId)
                : storeRepository.findActive();
        return buildDtos(stores);
    }

    public List<StoreViewDto> searchStores(String query) {
        Long userId = sessionContext.getCurrentUserId();
        List<Store> stores = userId != null
                ? storeRepository.searchByCodeOrNameAndUser(query, userId)
                : storeRepository.searchByCodeOrName(query);
        return buildDtos(stores);
    }

    /**
     * Pre-carga los 3 datasets en bulk (3 queries) y construye los DTOs sin N+1.
     * Antes: 291 tiendas × 3 queries = 873 queries. Ahora: 3 queries fijas.
     */
    private List<StoreViewDto> buildDtos(List<Store> stores) {
        if (stores.isEmpty()) return List.of();

        List<Long> storeIds = stores.stream().map(Store::getId).toList();
        LocalDate today = LocalDate.now(java.time.ZoneId.of("America/Bogota"));

        // 1. Gestiones de hoy → resultado por tienda
        Long userId = sessionContext.getCurrentUserId();
        List<Management> todayMgts = userId != null
                ? managementRepository.findTodayByUser(userId)
                : managementRepository.findAllToday();
        Map<Long, String> todayResultMap = todayMgts.stream()
                .collect(Collectors.toMap(Management::getStoreId, Management::getResultType, (a, b) -> a));

        // 2. Métricas diarias más recientes → por tienda
        List<DailyMetric> metrics = dailyMetricRepository.findByDate(today);
        if (metrics.isEmpty()) {
            LocalDate latest = dailyMetricRepository.findLatestDate().orElse(today);
            metrics = dailyMetricRepository.findByDate(latest);
        }
        Map<Long, DailyMetric> metricsMap = metrics.stream()
                .collect(Collectors.toMap(DailyMetric::getStoreId, m -> m, (a, b) -> a));

        // 3. Última gestión por tienda (últimos 30 días) → "Ayer · efectiva" etc.
        LocalDateTime since = today.minusDays(30).atStartOfDay();
        Map<Long, Management> lastContactMap = managementRepository
                .findRecentByStoreIds(storeIds, since)
                .stream()
                .collect(Collectors.toMap(Management::getStoreId, m -> m, (a, b) -> a));

        List<StoreViewDto> dtos = stores.stream()
                .map(s -> toViewDto(s, todayResultMap.get(s.getId()),
                        metricsMap.get(s.getId()), lastContactMap.get(s.getId())))
                .collect(Collectors.toList());

        propagateBrandManagement(dtos, todayResultMap);
        return dtos;
    }

    /**
     * Si cualquier tienda de una brand está gestionada hoy, marca las hermanas como BRAND_SYNC.
     * Usa el mapa pre-cargado (sin queries adicionales).
     */
    private void propagateBrandManagement(List<StoreViewDto> dtos, Map<Long, String> todayResultMap) {
        // Brands que ya tienen gestión hoy (sea en los DTOs o en el mapa completo)
        Set<String> managedBrands = dtos.stream()
                .filter(d -> d.getBrandId() != null && todayResultMap.containsKey(d.getId()))
                .map(StoreViewDto::getBrandId)
                .collect(Collectors.toSet());

        if (managedBrands.isEmpty()) return;

        dtos.forEach(d -> {
            if (d.getTodayManagementResult() == null
                    && d.getBrandId() != null
                    && managedBrands.contains(d.getBrandId())) {
                d.setTodayManagementResult("BRAND_SYNC");
            }
        });
    }

    public List<StoreViewDto> toViewDtos(List<Store> stores) {
        return buildDtos(stores);
    }

    public Optional<Store> findById(Long storeId) {
        return storeRepository.findById(storeId);
    }

    /**
     * Analiza la tendencia de conexión AVA comparando L4W vs L7D.
     * Retorna un texto formateado listo para mostrar en el diálogo.
     */
    public String getConnectionAnalysis(Long storeId) {
        return dailyMetricRepository.findLatestByStoreId(storeId)
                .map(m -> {
                    BigDecimal l4w = m.getConnectionPercentage();
                    BigDecimal l7d = m.getAvaL7d();

                    String l4wStr = l4w != null ? String.format("%.2f%%", l4w.doubleValue()) : "—";
                    String l7dStr = l7d != null ? String.format("%.2f%%", l7d.doubleValue()) : "—";

                    if (l4w == null || l7d == null) {
                        return String.format("AVA L4W: %s  |  AVA L7D: %s%n(Sin datos suficientes para analizar)", l4wStr, l7dStr);
                    }

                    double diff = l7d.doubleValue() - l4w.doubleValue();
                    String diagnostico;
                    String recomendacion;

                    if (diff > 5) {
                        diagnostico = "MEJORANDO";
                        recomendacion = "La tienda esta ganando conexion esta semana. Sin accion urgente.";
                    } else if (diff >= -5) {
                        diagnostico = "ESTABLE";
                        recomendacion = "Variacion normal. Monitorear en el proximo Excel.";
                    } else if (diff >= -10) {
                        diagnostico = "BAJANDO";
                        recomendacion = "Caida leve en los ultimos 7 dias. Hacer seguimiento pronto.";
                    } else {
                        diagnostico = "CRITICA";
                        recomendacion = String.format(
                                "CAIDA DE %.1f pp EN 7 DIAS. Contactar de inmediato.", Math.abs(diff));
                    }

                    return String.format(
                            "AVA L4W: %s  |  AVA L7D: %s  |  Diferencia: %+.1f pp%n" +
                            "Diagnostico: %s%n" +
                            "%s",
                            l4wStr, l7dStr, diff, diagnostico, recomendacion);
                })
                .orElse("Sin métricas de conexión registradas.");
    }

    /**
     * Retorna un texto con la información de la última gestión de la tienda.
     */
    public String getLastManagementSummary(Long storeId) {
        return managementRepository.findLatestByStoreId(storeId)
                .map(m -> {
                    LocalDate hoy = LocalDate.now();
                    LocalDate fechaGestion = m.getManagementDate().toLocalDate();
                    long diasAtras = ChronoUnit.DAYS.between(fechaGestion, hoy);

                    String detalle = m.getResultType() + " vía " + m.getManagementType();
                    if (diasAtras == 0) return "Hoy — " + detalle;
                    if (diasAtras == 1) return "Ayer — " + detalle;
                    return "Hace " + diasAtras + " días ("
                            + fechaGestion.format(DateTimeFormatter.ofPattern("dd/MM")) + ") — " + detalle;
                })
                .orElse("Sin gestiones registradas");
    }

    private StoreViewDto toViewDto(Store store, String todayResult, DailyMetric metric, Management lastMgt) {
        int aging = store.getHandoffActivatedAt() != null
                ? (int) ChronoUnit.DAYS.between(store.getHandoffActivatedAt(), LocalDate.now())
                : store.getAging() != null ? store.getAging()
                : store.getOnboardingDate() != null
                        ? (int) ChronoUnit.DAYS.between(store.getOnboardingDate(), LocalDate.now())
                        : 0;
        Integer diasSinLogin = store.getLastLoginDate() != null
                ? (int) ChronoUnit.DAYS.between(store.getLastLoginDate(), LocalDate.now())
                : null;
        String lastContact = lastMgt != null ? formatLastContact(lastMgt) : null;
        String segment    = resolveDashboardSegment(store, aging, metric);
        String churnLabel = detectChurnLabel(store.getCurrentStatus());
        if (churnLabel == null) churnLabel = detectChurnLabel(store.getGestionar());
        String avaLabel   = resolveAvaLabel(store, metric);
        return new StoreViewDto(
                store.getId(), store.getStoreCode(), store.getBrandId(), store.getStoreName(),
                store.getPhoneNumber(), aging, null,
                store.getConnectionPercentage(), store.getCurrentStatus(), null, todayResult, null,
                store.getHadHandoff(), store.getLastLoginDate(), diasSinLogin, store.getAgingStage(),
                churnLabel, avaLabel, store.getFarmerEmail(), store.getFarmerId(),
                null, null, null, segment, lastContact, store.getChannel(), store.getCredentialsDate());
    }

    private String formatLastContact(Management m) {
        long dias = ChronoUnit.DAYS.between(m.getManagementDate().toLocalDate(), LocalDate.now());
        String label = dias == 0 ? "Hoy" : dias == 1 ? "Ayer" : "Hace " + dias + "d";
        return label + " · " + m.getResultType().replace("_", " ").toLowerCase();
    }

    private String resolveDashboardSegment(Store store, int aging, DailyMetric metric) {
        boolean isSelf = store.getChannel() != null && store.getChannel().toLowerCase().contains("self");
        if (!isSelf && aging >= 1 && aging <= 8)  return "Onboarding";
        if (!isSelf && aging > 8  && aging <= 14) return "Aliados";
        String churn = detectChurnLabel(store.getCurrentStatus());
        if (churn == null) churn = detectChurnLabel(store.getGestionar());
        if (churn != null) return "Churn";
        if (metric != null && metric.getAvaMtd() != null) {
            BigDecimal pct = toPercent(metric.getAvaMtd());
            if (pct.compareTo(java.math.BigDecimal.valueOf(60)) >= 0) return "Saludable";
            if (pct.compareTo(java.math.BigDecimal.ZERO) > 0) return "AVA Bajando";
        }
        return "Sin clasificar";
    }

    private BigDecimal toPercent(BigDecimal val) {
        if (val == null) return BigDecimal.ZERO;
        return val.compareTo(BigDecimal.ONE) <= 0
                ? val.multiply(BigDecimal.valueOf(100))
                : val;
    }

    private static String detectChurnLabel(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String up = raw.trim().toUpperCase();
        if (up.equals("CHURN") || up.startsWith("CHURN:") || up.startsWith("MAX RISK")) return "Churn";
        if (up.contains("PREVENTION W3") || up.contains("PREVENTION_W3")) return "Prevention W3";
        if (up.contains("PREVENTION W2") || up.contains("PREVENTION_W2")) return "Prevention W2";
        if (up.contains("PREVENTION W1") || up.contains("PREVENTION_W1")) return "Prevention W1";
        if (up.contains("PREVENTION")) return "Prevention W1";
        return null;
    }

    private String resolveAvaLabel(Store store, DailyMetric metric) {
        if (metric == null || metric.getAvaMtd() == null) return null;
        BigDecimal pct = toPercent(metric.getAvaMtd());
        if (pct.compareTo(BigDecimal.ZERO) <= 0) return null;
        if (pct.compareTo(java.math.BigDecimal.valueOf(60)) < 0) {
            // Churn Ava = crítico (muy bajo, por debajo de un umbral adicional)
            if (pct.compareTo(java.math.BigDecimal.valueOf(30)) < 0) return "Churn Ava";
            return "Disminuye";
        }
        return null;
    }
}
