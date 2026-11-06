package com.rappi.farmer.application.services;

import com.rappi.farmer.infrastructure.persistence.repository.CropIntakeJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.HarvestJpaRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HarvestSourceTest {

    private static final LocalDate D = LocalDate.of(2026, 11, 5);

    @Test
    void sumsManualHarvestAndCropIntakesPerCategory() {
        HarvestJpaRepository harvest = mock(HarvestJpaRepository.class);
        CropIntakeJpaRepository intake = mock(CropIntakeJpaRepository.class);
        when(harvest.sumUpTo(D)).thenReturn(List.<Object[]>of(new Object[]{"SEGUNDA", 4L}));
        when(intake.sumUpTo(D)).thenReturn(List.<Object[]>of(new Object[]{"SEGUNDA", 6L}, new Object[]{"TERCERA", 3L}));

        List<Object[]> rows = new HarvestSource(harvest, intake).sumUpTo(D);
        assertEquals(2, rows.size());
        assertEquals(10L, rows.stream().filter(r -> r[0].equals("SEGUNDA")).findFirst().orElseThrow()[1]);
        assertEquals(3L, rows.stream().filter(r -> r[0].equals("TERCERA")).findFirst().orElseThrow()[1]);
    }

    @Test
    void mergesByDayAndCategory() {
        HarvestJpaRepository harvest = mock(HarvestJpaRepository.class);
        CropIntakeJpaRepository intake = mock(CropIntakeJpaRepository.class);
        when(harvest.sumByDay(D, D)).thenReturn(List.<Object[]>of(new Object[]{D, "SEGUNDA", 2L}));
        when(intake.sumByDay(D, D)).thenReturn(List.<Object[]>of(new Object[]{D, "SEGUNDA", 5L}));

        List<Object[]> rows = new HarvestSource(harvest, intake).sumByDay(D, D);
        assertEquals(1, rows.size());
        assertEquals(7L, rows.get(0)[2]);
    }
}
