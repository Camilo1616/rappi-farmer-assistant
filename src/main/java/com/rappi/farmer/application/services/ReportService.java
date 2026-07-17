package com.rappi.farmer.application.services;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ManagementRepository managementRepository;
    private final DailyMetricRepository dailyMetricRepository;
    private final SessionContext sessionContext;

    @Transactional(readOnly = true)
    public Map<String, Object> getDailyReport(LocalDate date) {
        Long userId = sessionContext.getCurrentUserId();
        List<Management> all = (date == null)
                ? managementRepository.findTodayByUser(userId)
                : managementRepository.findByDateAndUser(userId, date);

        // Solo las reales (no propagadas por brand sync)
        List<Management> real = all.stream().filter(Management::countsTowardMetrics).toList();

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
}
