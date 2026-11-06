package com.rappi.farmer.application.services;

import com.rappi.farmer.domain.enums.FruitCategory;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CultivoServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 5);
    private CropJpaRepository cropRepo;
    private CropPriceJpaRepository priceRepo;
    private CropIntakeJpaRepository intakeRepo;
    private DispatchService dispatch;
    private CultivoService service;

    @BeforeEach
    void setUp() {
        cropRepo = mock(CropJpaRepository.class);
        priceRepo = mock(CropPriceJpaRepository.class);
        intakeRepo = mock(CropIntakeJpaRepository.class);
        dispatch = mock(DispatchService.class);
        service = new CultivoService(cropRepo, priceRepo, intakeRepo, dispatch);
        when(cropRepo.existsById(1L)).thenReturn(true);
        when(intakeRepo.findByDayAndCropIdAndCategory(any(), any(), any())).thenReturn(Optional.empty());
    }

    @Test
    void newIntakeFreezesCurrentPurchasePriceAndRechecksStock() {
        CropPriceEntity p = new CropPriceEntity();
        p.setPrice(new BigDecimal("30000"));
        when(priceRepo.findByCropIdAndCategory(1L, "SEGUNDA")).thenReturn(Optional.of(p));

        service.setIntake(DAY, 1L, FruitCategory.SEGUNDA, 12);

        ArgumentCaptor<CropIntakeEntity> cap = ArgumentCaptor.forClass(CropIntakeEntity.class);
        verify(intakeRepo).save(cap.capture());
        assertEquals(12, cap.getValue().getBoxes());
        assertEquals(0, new BigDecimal("30000").compareTo(cap.getValue().getUnitPrice()));
        verify(dispatch).assertSupplyChangeKeepsStockValid(DAY, FruitCategory.SEGUNDA);
    }

    @Test
    void zeroBoxesDeletesTheIntake() {
        CropIntakeEntity existing = new CropIntakeEntity();
        when(intakeRepo.findByDayAndCropIdAndCategory(DAY, 1L, "SEGUNDA")).thenReturn(Optional.of(existing));
        service.setIntake(DAY, 1L, FruitCategory.SEGUNDA, 0);
        verify(intakeRepo).delete(existing);
        verify(intakeRepo, never()).save(any());
    }

    @Test
    void rejectsNegativeBoxesUnknownCropAndNegativePrice() {
        assertThrows(BusinessException.class, () -> service.setIntake(DAY, 1L, FruitCategory.SEGUNDA, -1));
        assertThrows(BusinessException.class, () -> service.setIntake(DAY, 99L, FruitCategory.SEGUNDA, 1));
        assertThrows(BusinessException.class, () -> service.setPrice(1L, FruitCategory.SEGUNDA, new BigDecimal("-1")));
    }

    @Test
    void cropNameIsRequired() {
        assertThrows(BusinessException.class, () -> service.createCrop("  "));
    }
}
