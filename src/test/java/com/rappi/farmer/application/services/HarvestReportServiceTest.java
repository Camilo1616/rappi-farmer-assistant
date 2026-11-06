package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.HarvestReportDto;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class HarvestReportServiceTest {

    private static final LocalDate FROM = LocalDate.of(2026, 11, 2);
    private static final LocalDate TO = LocalDate.of(2026, 11, 8);

    private HarvestSource harvestSource;
    private DiscardJpaRepository discardRepo;
    private DispatchLineJpaRepository lineRepo;
    private HarvestReportService service;

    @BeforeEach
    void setUp() {
        harvestSource = mock(HarvestSource.class);
        discardRepo = mock(DiscardJpaRepository.class);
        lineRepo = mock(DispatchLineJpaRepository.class);
        service = new HarvestReportService(harvestSource, discardRepo, lineRepo);
        when(harvestSource.sumUpTo(any())).thenReturn(List.of());
        when(discardRepo.sumUpTo(any())).thenReturn(List.of());
        when(lineRepo.sumDeliveredUpTo(any())).thenReturn(List.of());
        when(harvestSource.sumByDay(any(), any())).thenReturn(List.of());
        when(discardRepo.sumByDay(any(), any())).thenReturn(List.of());
        when(lineRepo.summaryByDay(any(), any())).thenReturn(List.of());
    }

    @Test
    void harvestedVersusSoldWithOpeningStockAndDiscards() {
        // Antes del periodo: cosecha 10, entrega 4 -> arrancan 6 cajas de Segunda
        when(harvestSource.sumUpTo(FROM.minusDays(1))).thenReturn(List.<Object[]>of(new Object[]{"SEGUNDA", 10L}));
        when(lineRepo.sumDeliveredUpTo(FROM.minusDays(1))).thenReturn(List.<Object[]>of(new Object[]{"SEGUNDA", 4L}));
        // Periodo: cosecha 20 (2 dias), entrega 18, pedido 25, descarte 2, ventas 1.404.000
        when(harvestSource.sumByDay(FROM, TO)).thenReturn(List.<Object[]>of(
                new Object[]{FROM, "SEGUNDA", 12L}, new Object[]{FROM.plusDays(1), "SEGUNDA", 8L}));
        when(lineRepo.summaryByDay(FROM, TO)).thenReturn(List.<Object[]>of(
                new Object[]{FROM, "SEGUNDA", 18L, 25L, new BigDecimal("1404000")}));
        when(discardRepo.sumByDay(FROM, TO)).thenReturn(List.<Object[]>of(new Object[]{FROM.plusDays(1), "SEGUNDA", 2L}));

        HarvestReportDto r = service.getReport(FROM, TO);
        assertEquals(6, r.totals().openingStock());
        assertEquals(20, r.totals().harvested());
        assertEquals(18, r.totals().delivered());
        assertEquals(25, r.totals().ordered());
        assertEquals(2, r.totals().discarded());
        assertEquals(6, r.totals().endingStock());                 // 6 + 20 - 18 - 2
        assertEquals(69, r.totals().sellThroughPct());             // 18 / 26
        assertEquals(0, new BigDecimal("1404000").compareTo(r.totals().sales()));
        assertEquals(2, r.days().size());
        assertEquals(12, r.days().get(0).harvested());
    }

    @Test
    void emptyPeriodHasZeroSellThrough() {
        HarvestReportDto r = service.getReport(FROM, TO);
        assertEquals(0, r.totals().sellThroughPct());
        assertTrue(r.days().isEmpty());
    }

    @Test
    void invalidRangesAreRejected() {
        assertThrows(BusinessException.class, () -> service.getReport(TO, FROM));
        assertThrows(BusinessException.class, () -> service.getReport(FROM, FROM.plusDays(400)));
    }
}
