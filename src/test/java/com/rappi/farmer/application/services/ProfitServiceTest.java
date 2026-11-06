package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ProfitDto;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProfitServiceTest {

    private static final LocalDate D = LocalDate.of(2026, 11, 3);

    private static BigDecimal bd(String s) {
        return new BigDecimal(s);
    }

    @Test
    void reproducesAngelasNotebookDay() {
        // Cuaderno: cultivo 5.790.000, distribuido 8.912.000, gastos 1.218.500 -> utilidad 1.903.500
        DispatchLineJpaRepository lines = mock(DispatchLineJpaRepository.class);
        CropIntakeJpaRepository intakes = mock(CropIntakeJpaRepository.class);
        TripEntryJpaRepository entries = mock(TripEntryJpaRepository.class);
        when(lines.summaryByDay(D, D)).thenReturn(List.<Object[]>of(new Object[]{D, "SEGUNDA", 100L, 100L, bd("8912000")}));
        when(intakes.costByDay(D, D)).thenReturn(List.<Object[]>of(new Object[]{D, bd("5790000")}));
        when(entries.totalsByDay(D, D)).thenReturn(List.<Object[]>of(new Object[]{D, "EXPENSE", bd("1218500")}));

        ProfitDto p = new ProfitService(lines, intakes, entries).getProfit(D, D);
        assertEquals(0, bd("1903500").compareTo(p.totals().profit()));
        assertEquals(1, p.days().size());
    }

    @Test
    void freightIncomeAddsToProfit() {
        DispatchLineJpaRepository lines = mock(DispatchLineJpaRepository.class);
        CropIntakeJpaRepository intakes = mock(CropIntakeJpaRepository.class);
        TripEntryJpaRepository entries = mock(TripEntryJpaRepository.class);
        when(lines.summaryByDay(D, D)).thenReturn(List.of());
        when(intakes.costByDay(D, D)).thenReturn(List.of());
        when(entries.totalsByDay(D, D)).thenReturn(List.<Object[]>of(
                new Object[]{D, "INCOME", bd("1326000")}, new Object[]{D, "EXPENSE", bd("879200")}));
        ProfitDto p = new ProfitService(lines, intakes, entries).getProfit(D, D);
        assertEquals(0, bd("446800").compareTo(p.totals().profit()));
    }

    @Test
    void invalidRangeIsRejected() {
        ProfitService s = new ProfitService(mock(DispatchLineJpaRepository.class), mock(CropIntakeJpaRepository.class),
                mock(TripEntryJpaRepository.class));
        assertThrows(BusinessException.class, () -> s.getProfit(D, D.minusDays(1)));
        assertThrows(BusinessException.class, () -> s.getProfit(D, D.plusDays(400)));
    }
}
