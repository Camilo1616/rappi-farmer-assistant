package com.rappi.farmer.application.services;

import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.exceptions.InsufficientStrawberriesException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SalesServiceTest {

    private SaleJpaRepository saleRepo;
    private SaleOrderJpaRepository orderRepo;
    private CropJpaRepository cropRepo;
    private StrawberryBankJpaRepository bankRepo;
    private SalesService service;
    private StrawberryBankEntity bank;

    @BeforeEach
    void setUp() {
        saleRepo = mock(SaleJpaRepository.class);
        orderRepo = mock(SaleOrderJpaRepository.class);
        cropRepo = mock(CropJpaRepository.class);
        bankRepo = mock(StrawberryBankJpaRepository.class);
        service = new SalesService(saleRepo, orderRepo, cropRepo, bankRepo);
        bank = new StrawberryBankEntity();
        bank.setId(1L);
        when(bankRepo.findForUpdate(1L)).thenReturn(Optional.of(bank));
        when(saleRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(orderRepo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private SaleEntity sale(String status, String kg) {
        SaleEntity s = new SaleEntity();
        s.setId(10L);
        s.setStatus(status);
        s.setQuantityKg(new BigDecimal(kg));
        when(saleRepo.findById(10L)).thenReturn(Optional.of(s));
        return s;
    }

    @Test
    void orderIsRejectedWhenBankIsEmpty() {
        SaleEntity s = sale(SalesService.CONFIRMADA, "5");
        assertThrows(InsufficientStrawberriesException.class, () -> service.createOrder(10L));
        assertEquals(SalesService.CONFIRMADA, s.getStatus());
        verify(orderRepo, never()).save(any());
    }

    @Test
    void orderDiscountsBankWhenStockIsEnough() {
        bank.setQuantityKg(new BigDecimal("8"));
        SaleEntity s = sale(SalesService.CONFIRMADA, "5");
        service.createOrder(10L);
        assertEquals(0, new BigDecimal("3").compareTo(bank.getQuantityKg()));
        assertEquals(SalesService.PEDIDO_CREADO, s.getStatus());
    }

    @Test
    void orderRequiresConfirmedSale() {
        sale(SalesService.PENDIENTE, "5");
        assertThrows(BusinessException.class, () -> service.createOrder(10L));
    }

    @Test
    void harvestAddsToBankAndCrop() {
        CropEntity crop = new CropEntity();
        crop.setId(2L);
        when(cropRepo.findById(2L)).thenReturn(Optional.of(crop));
        when(cropRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        service.harvest(2L, new BigDecimal("4"));
        assertEquals(0, new BigDecimal("4").compareTo(bank.getQuantityKg()));
        assertEquals(0, new BigDecimal("4").compareTo(crop.getHarvestedKg()));
    }
}
