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
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

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
        return stores.stream().map(this::toViewDto).toList();
    }

    public List<StoreViewDto> searchStores(String query) {
        Long userId = sessionContext.getCurrentUserId();
        List<Store> stores;
        if (userId != null) {
            stores = storeRepository.searchByCodeOrNameAndUser(query, userId);
        } else {
            stores = storeRepository.searchByCodeOrName(query);
        }
        return stores.stream().map(this::toViewDto).toList();
    }

    public List<StoreViewDto> toViewDtos(List<Store> stores) {
        return stores.stream().map(this::toViewDto).toList();
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

    private StoreViewDto toViewDto(Store store) {
        int aging = store.getHandoffActivatedAt() != null
                ? (int) ChronoUnit.DAYS.between(store.getHandoffActivatedAt(), LocalDate.now())
                : store.getAging() != null ? store.getAging()
                : store.getOnboardingDate() != null
                        ? (int) ChronoUnit.DAYS.between(store.getOnboardingDate(), LocalDate.now())
                        : 0;
        String todayResult = managementRepository.findLatestTodayByStoreId(store.getId())
                .map(Management::getResultType)
                .orElse(null);
        Integer diasSinLogin = store.getLastLoginDate() != null
                ? (int) java.time.temporal.ChronoUnit.DAYS.between(store.getLastLoginDate(), LocalDate.now())
                : null;
        return new StoreViewDto(
                store.getId(), store.getStoreCode(), store.getStoreName(),
                store.getPhoneNumber(), aging, null,
                store.getConnectionPercentage(), store.getCurrentStatus(), null, todayResult, null,
                store.getHadHandoff(), store.getLastLoginDate(), diasSinLogin, store.getAgingStage(), null, null, store.getFarmerEmail());
    }
}
