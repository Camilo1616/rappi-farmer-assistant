package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.HarvestReportDto;
import com.rappi.farmer.application.dtos.HarvestReportDto.*;
import com.rappi.farmer.domain.enums.FruitCategory;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Reporte semanal/mensual: cosechado contra vendido, descartes y fresa que queda en stock. */
@Service
@RequiredArgsConstructor
public class HarvestReportService {

    private static final long MAX_DAYS = 366;

    private final HarvestSource harvestSource;
    private final DiscardJpaRepository discardRepo;
    private final DispatchLineJpaRepository lineRepo;

    @Transactional(readOnly = true)
    public HarvestReportDto getReport(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new BusinessException("El rango de fechas no es válido");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_DAYS) {
            throw new BusinessException("El rango no puede superar un año");
        }

        // Stock con el que arranca el periodo = lo acumulado hasta el dia anterior
        LocalDate prev = from.minusDays(1);
        Map<String, Integer> hPrev = totalByCategory(harvestSource.sumUpTo(prev));
        Map<String, Integer> dPrev = totalByCategory(lineRepo.sumDeliveredUpTo(prev));
        Map<String, Integer> xPrev = totalByCategory(discardRepo.sumUpTo(prev));

        Map<String, int[]> cat = new HashMap<>();          // [cosechado, entregado, descartado]
        Map<String, BigDecimal> catSales = new HashMap<>();
        Map<LocalDate, int[]> day = new TreeMap<>();       // [cosechado, entregado, descartado]
        Map<LocalDate, BigDecimal> daySales = new HashMap<>();
        int ordered = 0;

        for (Object[] r : harvestSource.sumByDay(from, to)) {
            int n = ((Number) r[2]).intValue();
            cat.computeIfAbsent((String) r[1], k -> new int[3])[0] += n;
            day.computeIfAbsent((LocalDate) r[0], k -> new int[3])[0] += n;
        }
        for (Object[] r : discardRepo.sumByDay(from, to)) {
            int n = ((Number) r[2]).intValue();
            cat.computeIfAbsent((String) r[1], k -> new int[3])[2] += n;
            day.computeIfAbsent((LocalDate) r[0], k -> new int[3])[2] += n;
        }
        for (Object[] r : lineRepo.summaryByDay(from, to)) {
            int delivered = ((Number) r[2]).intValue();
            BigDecimal money = new BigDecimal(r[4].toString());
            cat.computeIfAbsent((String) r[1], k -> new int[3])[1] += delivered;
            day.computeIfAbsent((LocalDate) r[0], k -> new int[3])[1] += delivered;
            catSales.merge((String) r[1], money, BigDecimal::add);
            daySales.merge((LocalDate) r[0], money, BigDecimal::add);
            ordered += ((Number) r[3]).intValue();
        }

        List<CategoryRowDto> categories = new ArrayList<>();
        int oS = 0, h = 0, d = 0, x = 0, end = 0;
        BigDecimal sales = BigDecimal.ZERO;
        for (FruitCategory c : FruitCategory.values()) {
            String k = c.name();
            int[] v = cat.getOrDefault(k, new int[3]);
            int opening = get(hPrev, k) - get(dPrev, k) - get(xPrev, k);
            int ending = opening + v[0] - v[1] - v[2];
            BigDecimal s = catSales.getOrDefault(k, BigDecimal.ZERO);
            categories.add(new CategoryRowDto(k, c.label(), opening, v[0], v[1], v[2], ending, s));
            oS += opening; h += v[0]; d += v[1]; x += v[2]; end += ending;
            sales = sales.add(s);
        }
        int available = oS + h;
        int pct = available == 0 ? 0 : Math.round(d * 100f / available);

        List<DayRowDto> days = new ArrayList<>();
        day.forEach((date, v) -> days.add(new DayRowDto(date, v[0], v[1], v[2],
                daySales.getOrDefault(date, BigDecimal.ZERO))));
        return new HarvestReportDto(from, to, new TotalsDto(oS, h, ordered, d, x, end, sales, pct), categories, days);
    }

    private static Map<String, Integer> totalByCategory(List<Object[]> rows) {
        Map<String, Integer> m = new HashMap<>();
        for (Object[] r : rows) m.put((String) r[0], ((Number) r[1]).intValue());
        return m;
    }

    private static int get(Map<String, Integer> m, String k) {
        return m.getOrDefault(k, 0);
    }
}
