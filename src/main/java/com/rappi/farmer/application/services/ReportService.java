package com.rappi.farmer.application.services;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ManagementRepository managementRepository;
    private final StoreRepository storeRepository;
    private final DailyMetricRepository dailyMetricRepository;
    private final DashboardService dashboardService;
    private final SessionContext sessionContext;

    @Transactional(readOnly = true)
    public Map<String, Object> getDailyReport() {
        Long userId = sessionContext.getCurrentUserId();
        List<Management> all = managementRepository.findTodayByUser(userId);

        // Solo las reales (no brandSync)
        List<Management> real = all.stream().filter(m -> !m.isBrandSync()).toList();

        long efectivas    = real.stream().filter(m -> "EFECTIVA".equals(m.getResultType())).count();
        long noContacto   = real.stream().filter(m -> "NO_CONTACTO".equals(m.getResultType())).count();
        long whatsapp     = real.stream().filter(m -> "WHATSAPP".equals(m.getManagementType())).count();
        long llamadas     = real.stream().filter(m -> "LLAMADA".equals(m.getManagementType())).count();
        long sac          = real.stream().filter(m -> "SAC".equals(m.getManagementType())).count();
        long seguimiento  = real.stream().filter(m -> "SEGUIMIENTO".equals(m.getManagementType())).count();
        long activacion   = real.stream().filter(m -> "ACTIVACION".equals(m.getManagementType())).count();

        // Detalle para tabla
        List<Map<String, Object>> rows = real.stream()
                .sorted(Comparator.comparing(Management::getManagementDate).reversed())
                .map(m -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",             m.getId());
                    row.put("hora",           m.getManagementDate().toLocalTime().toString().substring(0, 5));
                    row.put("storeName",      m.getStoreName());
                    row.put("storeCode",      m.getStoreCode());
                    row.put("managementType", m.getManagementType());
                    row.put("resultType",     m.getResultType());
                    row.put("comments",       m.getComments());
                    return row;
                }).toList();

        // Metas
        Map<String, Object> metas = new LinkedHashMap<>();
        metas.put("efectivas",       efectivas);
        metas.put("metaEfectivas",   15);
        metas.put("noContacto",      noContacto);
        metas.put("metaNoContactoMin", 25);
        metas.put("metaNoContactoMax", 40);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total",      real.size());
        result.put("efectivas",  efectivas);
        result.put("noContacto", noContacto);
        result.put("whatsapp",   whatsapp);
        result.put("llamadas",   llamadas);
        result.put("sac",        sac);
        result.put("seguimiento",seguimiento);
        result.put("activacion", activacion);
        result.put("metas",      metas);
        result.put("rows",       rows);
        return result;
    }

    public Map<String, Object> getPortfolioReport() {
        var dash = dashboardService.load();

        // sinClasificar = total - suma de secciones conocidas
        int total        = dash.getTotalCount();
        int onboarding   = dash.getOnboardingCount();
        int aliados      = dash.getAliadosCount();
        int churn        = dash.getChurnCount();
        int ava          = dash.getAvaCount();
        int healthy      = dash.getHealthyCount();
        int selfOnboardingCount = dash.getSelfOnboardingCount();
        int sinClasificar = total - onboarding - aliados - churn - ava - healthy - selfOnboardingCount;

        // sinVentas y sinTelefono desde las listas del dashboard
        var allStores = new java.util.ArrayList<com.rappi.farmer.application.dtos.StoreViewDto>();
        allStores.addAll(dash.getOnboardingCritical());
        allStores.addAll(dash.getAliados());
        allStores.addAll(dash.getChurnRisk());
        allStores.addAll(dash.getAva());
        allStores.addAll(dash.getHealthy());

        long sinTelefono = allStores.stream().filter(s -> s.getPhoneNumber() == null || s.getPhoneNumber().isBlank()).count();
        long sinVentas   = allStores.stream().filter(s -> s.getOrdersL4W() == null || s.getOrdersL4W() == 0).count();

        // Listas de tiendas por sección (para modal de detalle)
        java.util.function.Function<com.rappi.farmer.application.dtos.StoreViewDto, Map<String,Object>> toRow = s -> {
            Map<String,Object> r = new LinkedHashMap<>();
            r.put("id",          s.getId());
            r.put("storeName",   s.getStoreName());
            r.put("storeCode",   s.getStoreCode());
            r.put("phoneNumber", s.getPhoneNumber());
            r.put("aging",       s.getAging());
            r.put("currentStatus", s.getCurrentStatus());
            return r;
        };

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total",         total);
        result.put("onboarding",    onboarding);
        result.put("aliados",       aliados);
        result.put("churn",         churn);
        result.put("ava",           ava);
        result.put("healthy",       healthy);
        result.put("sinClasificar", Math.max(0, sinClasificar));
        result.put("sinVentas",     sinVentas);
        result.put("sinTelefono",   sinTelefono);
        // Tiendas sin clasificar = activas que no están en ninguna sección del dashboard
        Long userId = sessionContext.getCurrentUserId();
        java.util.Set<Long> clasificadas = new java.util.HashSet<>();
        dash.getOnboardingCritical().forEach(s -> clasificadas.add(s.getId()));
        dash.getAliados().forEach(s -> clasificadas.add(s.getId()));
        dash.getChurnRisk().forEach(s -> clasificadas.add(s.getId()));
        dash.getAva().forEach(s -> clasificadas.add(s.getId()));
        dash.getHealthy().forEach(s -> clasificadas.add(s.getId()));

        List<Map<String, Object>> storesSinClasificar = storeRepository.findActiveByUser(userId).stream()
                .filter(s -> !clasificadas.contains(s.getId()))
                .map(s -> {
                    Map<String, Object> r = new LinkedHashMap<>();
                    r.put("id",            s.getId());
                    r.put("storeName",     s.getStoreName());
                    r.put("storeCode",     s.getStoreCode());
                    r.put("phoneNumber",   s.getPhoneNumber());
                    r.put("aging",         s.getAging());
                    r.put("currentStatus", s.getCurrentStatus());
                    return r;
                }).toList();

        result.put("selfOnboarding",       dash.getSelfOnboardingCount());
        result.put("storesOnboarding",     dash.getOnboardingCritical().stream().map(toRow).toList());
        result.put("storesAliados",        dash.getAliados().stream().map(toRow).toList());
        result.put("storesChurn",          dash.getChurnRisk().stream().map(toRow).toList());
        result.put("storesAva",            dash.getAva().stream().map(toRow).toList());
        result.put("storesHealthy",        dash.getHealthy().stream().map(toRow).toList());
        result.put("storesSelfOnboarding", dash.getSelfOnboarding().stream().map(toRow).toList());
        result.put("storesSinClasificar", storesSinClasificar);
        return result;
    }
}
