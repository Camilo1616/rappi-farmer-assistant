package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.DispatchDayDto;
import com.rappi.farmer.domain.enums.FruitCategory;
import com.rappi.farmer.domain.exceptions.InsufficientStockException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DispatchServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 5);

    private DispatchSectorJpaRepository sectorRepo;
    private DispatchClientJpaRepository clientRepo;
    private CategoryPriceJpaRepository priceRepo;
    private HarvestJpaRepository harvestRepo;
    private HarvestSource harvestSource;
    private CropIntakeJpaRepository intakeRepo;
    private DelinquencyService delinquency;
    private DiscardJpaRepository discardRepo;
    private DispatchLineJpaRepository lineRepo;
    private DispatchService service;

    @BeforeEach
    void setUp() {
        sectorRepo = mock(DispatchSectorJpaRepository.class);
        clientRepo = mock(DispatchClientJpaRepository.class);
        priceRepo = mock(CategoryPriceJpaRepository.class);
        harvestRepo = mock(HarvestJpaRepository.class);
        harvestSource = mock(HarvestSource.class);
        intakeRepo = mock(CropIntakeJpaRepository.class);
        delinquency = mock(DelinquencyService.class);
        discardRepo = mock(DiscardJpaRepository.class);
        lineRepo = mock(DispatchLineJpaRepository.class);
        service = new DispatchService(sectorRepo, clientRepo, priceRepo, harvestRepo, discardRepo, lineRepo,
                harvestSource, intakeRepo, delinquency);

        when(clientRepo.findById(1L)).thenReturn(Optional.of(new DispatchClientEntity()));
        when(harvestSource.sumUpTo(any())).thenReturn(List.of());
        when(discardRepo.sumUpTo(any())).thenReturn(List.of());
        when(lineRepo.sumDeliveredUpTo(any())).thenReturn(List.of());
        when(lineRepo.findByDayAndClientIdAndCategory(any(), any(), any())).thenReturn(Optional.empty());
        CategoryPriceEntity p = new CategoryPriceEntity();
        p.setCategory("SEGUNDA");
        p.setPrice(new BigDecimal("78000"));
        when(priceRepo.findAll()).thenReturn(List.of(p));
    }

    private static List<Object[]> rows(String cat, long n) {
        return List.<Object[]>of(new Object[]{cat, n});
    }

    @Test
    void deliveringMoreThanStockIsRejectedWithMaxAllowed() {
        when(harvestSource.sumUpTo(any())).thenReturn(rows("SEGUNDA", 5));
        when(lineRepo.sumDeliveredUpTo(any())).thenReturn(rows("SEGUNDA", 8)); // ya incluye esta entrega
        InsufficientStockException e = assertThrows(InsufficientStockException.class,
                () -> service.setLine(DAY, 1L, FruitCategory.SEGUNDA, 8, 8));
        assertEquals(5, e.getMaxAllowed());
    }

    @Test
    void deliveringLessThanOrderedIsAllowed() {
        when(harvestSource.sumUpTo(any())).thenReturn(rows("SEGUNDA", 5));
        when(lineRepo.sumDeliveredUpTo(any())).thenReturn(rows("SEGUNDA", 3));
        assertDoesNotThrow(() -> service.setLine(DAY, 1L, FruitCategory.SEGUNDA, 7, 3));
    }

    @Test
    void newLineFreezesCurrentPrice() {
        when(harvestSource.sumUpTo(any())).thenReturn(rows("SEGUNDA", 5));
        when(lineRepo.sumDeliveredUpTo(any())).thenReturn(rows("SEGUNDA", 2));
        service.setLine(DAY, 1L, FruitCategory.SEGUNDA, 2, 2);
        ArgumentCaptor<DispatchLineEntity> cap = ArgumentCaptor.forClass(DispatchLineEntity.class);
        verify(lineRepo).save(cap.capture());
        assertEquals(0, new BigDecimal("78000").compareTo(cap.getValue().getUnitPrice()));
    }

    @Test
    void zeroOrderedAndDeliveredRemovesTheLine() {
        DispatchLineEntity existing = new DispatchLineEntity();
        when(lineRepo.findByDayAndClientIdAndCategory(DAY, 1L, "SEGUNDA")).thenReturn(Optional.of(existing));
        service.setLine(DAY, 1L, FruitCategory.SEGUNDA, 0, 0);
        verify(lineRepo).delete(existing);
        verify(lineRepo, never()).save(any());
    }

    @Test
    void harvestCannotDropBelowWhatWasAlreadyDelivered() {
        when(harvestSource.sumUpTo(any())).thenReturn(rows("SEGUNDA", 2));
        when(lineRepo.sumDeliveredUpTo(any())).thenReturn(rows("SEGUNDA", 4));
        assertThrows(RuntimeException.class, () -> service.setHarvest(DAY, FruitCategory.SEGUNDA, 2));
    }

    @Test
    void leftoverFromYesterdayCarriesOverToToday() {
        // Ayer: cosecha 10, entrega 4 -> arrastre 6. Hoy: +5 cosechadas, 3 entregadas.
        when(harvestSource.sumUpTo(DAY.minusDays(1))).thenReturn(rows("SEGUNDA", 10));
        when(lineRepo.sumDeliveredUpTo(DAY.minusDays(1))).thenReturn(rows("SEGUNDA", 4));
        when(harvestSource.sumUpTo(DAY)).thenReturn(rows("SEGUNDA", 15));
        when(lineRepo.sumDeliveredUpTo(DAY)).thenReturn(rows("SEGUNDA", 7));

        DispatchDayDto day = service.getDay(DAY);
        DispatchDayDto.StockDto s = day.stock().stream()
                .filter(x -> x.category().equals("SEGUNDA")).findFirst().orElseThrow();
        assertEquals(6, s.carryover());
        assertEquals(5, s.harvested());
        assertEquals(3, s.delivered());
        assertEquals(8, s.available()); // 6 + 5 - 3
        assertEquals(8, day.summary().leftoverBoxes());
    }
}
