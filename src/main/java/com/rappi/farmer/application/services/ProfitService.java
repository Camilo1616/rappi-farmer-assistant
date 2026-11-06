package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ProfitDto;
import com.rappi.farmer.application.dtos.ProfitDto.*;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Utilidad por dia y por periodo: ventas + fletes - costo de cultivos - gastos de viaje. */
@Service
@RequiredArgsConstructor
public class ProfitService {

    private static final long MAX_DAYS = 366;

    private final DispatchLineJpaRepository lineRepo;
    private final CropIntakeJpaRepository intakeRepo;
    private final TripEntryJpaRepository entryRepo;

    @Transactional(readOnly = true)
    public ProfitDto getProfit(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) throw new BusinessException("El rango de fechas no es válido");
        if (ChronoUnit.DAYS.between(from, to) > MAX_DAYS) throw new BusinessException("El rango no puede superar un año");

        Map<LocalDate, BigDecimal[]> days = new TreeMap<>(); // [ventas, fletes, costo, gastos]
        for (Object[] r : lineRepo.summaryByDay(from, to)) add(days, (LocalDate) r[0], 0, new BigDecimal(r[4].toString()));
        for (Object[] r : intakeRepo.costByDay(from, to)) add(days, (LocalDate) r[0], 2, new BigDecimal(r[1].toString()));
        for (Object[] r : entryRepo.totalsByDay(from, to)) {
            add(days, (LocalDate) r[0], TripService.INCOME.equals(r[1]) ? 1 : 3, new BigDecimal(r[2].toString()));
        }

        BigDecimal[] total = zeros();
        List<DayDto> out = new ArrayList<>();
        days.forEach((d, v) -> {
            out.add(new DayDto(d, v[0], v[1], v[2], v[3], profit(v)));
            for (int i = 0; i < 4; i++) total[i] = total[i].add(v[i]);
        });
        return new ProfitDto(from, to, new TotalsDto(total[0], total[1], total[2], total[3], profit(total)), out);
    }

    static BigDecimal profit(BigDecimal[] v) {
        return v[0].add(v[1]).subtract(v[2]).subtract(v[3]);
    }

    private static void add(Map<LocalDate, BigDecimal[]> m, LocalDate d, int idx, BigDecimal value) {
        BigDecimal[] v = m.computeIfAbsent(d, k -> zeros());
        v[idx] = v[idx].add(value);
    }

    private static BigDecimal[] zeros() {
        return new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO};
    }
}
