package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.TripDayDto;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TripServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 5);
    private TripJpaRepository tripRepo;
    private TripEntryJpaRepository entryRepo;
    private RatePresetJpaRepository presetRepo;
    private TripService service;

    private static BigDecimal bd(String s) {
        return new BigDecimal(s);
    }

    @BeforeEach
    void setUp() {
        tripRepo = mock(TripJpaRepository.class);
        entryRepo = mock(TripEntryJpaRepository.class);
        presetRepo = mock(RatePresetJpaRepository.class);
        service = new TripService(tripRepo, entryRepo, presetRepo);
    }

    @Test
    void amountIsBoxesTimesRateWhenBothGiven() {
        assertEquals(0, bd("571500").compareTo(TripService.computeAmount(127, bd("4500"), null)));
    }

    @Test
    void amountFallsBackToFixedValue() {
        assertEquals(0, bd("298000").compareTo(TripService.computeAmount(null, null, bd("298000"))));
    }

    @Test
    void invalidAmountsAreRejected() {
        assertThrows(BusinessException.class, () -> TripService.computeAmount(null, null, null));
        assertThrows(BusinessException.class, () -> TripService.computeAmount(null, null, BigDecimal.ZERO));
        assertThrows(BusinessException.class, () -> TripService.computeAmount(0, bd("1000"), null));
    }

    @Test
    void tripNetIsFreightIncomeMinusExpenses() {
        TripEntity t = new TripEntity();
        t.setId(1L);
        when(tripRepo.findByDayOrderByIdAsc(DAY)).thenReturn(List.of(t));
        when(presetRepo.findAllByOrderByKindAscConceptAsc()).thenReturn(List.of());
        when(entryRepo.findByTripIdIn(List.of(1L))).thenReturn(List.of(
                entry("INCOME", "Flete finca", "1326000"),
                entry("EXPENSE", "ACPM", "298000"),
                entry("EXPENSE", "Peajes", "225200"),
                entry("EXPENSE", "Conductor fijo", "265000")));

        TripDayDto day = service.getDay(DAY);
        assertEquals(0, bd("1326000").compareTo(day.income()));
        assertEquals(0, bd("788200").compareTo(day.expense()));
        assertEquals(0, bd("537800").compareTo(day.net()));
        assertEquals(0, bd("537800").compareTo(day.trips().get(0).net()));
    }

    private static TripEntryEntity entry(String type, String concept, String amount) {
        TripEntryEntity e = new TripEntryEntity();
        e.setTripId(1L);
        e.setType(type);
        e.setConcept(concept);
        e.setAmount(new BigDecimal(amount));
        return e;
    }

    @Test
    void entryRequiresExistingTripAndValidType() {
        when(tripRepo.existsById(1L)).thenReturn(true);
        when(tripRepo.existsById(9L)).thenReturn(false);
        assertThrows(BusinessException.class, () -> service.addEntry(9L, "EXPENSE", "ACPM", null, null, bd("1")));
        assertThrows(BusinessException.class, () -> service.addEntry(1L, "OTRO", "ACPM", null, null, bd("1")));
        service.addEntry(1L, "EXPENSE", "ACPM", null, null, bd("298000"));
        verify(entryRepo).save(any());
    }
}
