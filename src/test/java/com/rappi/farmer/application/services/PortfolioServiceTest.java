package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.PortfolioDto;
import com.rappi.farmer.domain.enums.PaymentType;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PortfolioServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 5);
    private DispatchSectorJpaRepository sectorRepo;
    private DispatchClientJpaRepository clientRepo;
    private DispatchLineJpaRepository lineRepo;
    private ClientPaymentJpaRepository paymentRepo;
    private PortfolioService service;

    @BeforeEach
    void setUp() {
        sectorRepo = mock(DispatchSectorJpaRepository.class);
        clientRepo = mock(DispatchClientJpaRepository.class);
        lineRepo = mock(DispatchLineJpaRepository.class);
        paymentRepo = mock(ClientPaymentJpaRepository.class);
        service = new PortfolioService(sectorRepo, clientRepo, lineRepo, paymentRepo);
    }

    private static BigDecimal bd(String s) {
        return new BigDecimal(s);
    }

    @Test
    void balanceIsOpeningPlusBilledMinusDiscountsAndPayments() {
        assertEquals(0, bd("1000000").compareTo(PortfolioService.balance(
                bd("500000"), bd("702000"), bd("2000"), bd("100000"), bd("100000"))));
    }

    @Test
    void portfolioComputesClientBalanceAndTodaySummary() {
        DispatchSectorEntity s = new DispatchSectorEntity();
        s.setId(1L);
        s.setName("Mercasa");
        DispatchClientEntity c = new DispatchClientEntity();
        c.setId(7L);
        c.setSectorId(1L);
        c.setName("Marina");
        c.setOpeningBalance(bd("420000"));
        when(sectorRepo.findAllByOrderByNameAsc()).thenReturn(List.of(s));
        when(clientRepo.findAllByOrderByNameAsc()).thenReturn(List.of(c));
        // Facturado acumulado: 702.000 hasta hoy, 0 hasta ayer -> ventas de hoy 702.000
        when(lineRepo.billedUpTo(DAY)).thenReturn(List.<Object[]>of(new Object[]{7L, bd("702000")}));
        when(lineRepo.billedUpTo(DAY.minusDays(1))).thenReturn(List.of());
        when(paymentRepo.sumUpTo(DAY)).thenReturn(List.<Object[]>of(
                new Object[]{7L, "ABONO", bd("200000")}, new Object[]{7L, "CONSIGNACION", bd("420000")}));
        ClientPaymentEntity p = new ClientPaymentEntity();
        p.setId(1L);
        p.setClientId(7L);
        p.setType("ABONO");
        p.setAmount(bd("200000"));
        when(paymentRepo.findByDayOrderByIdAsc(DAY)).thenReturn(List.of(p));

        PortfolioDto dto = service.getPortfolio(DAY);
        PortfolioDto.ClientBalanceDto cb = dto.sectors().get(0).clients().get(0);
        assertEquals(0, bd("502000").compareTo(cb.balance())); // 420 + 702 - 200 - 420
        assertEquals(0, bd("702000").compareTo(dto.summary().salesToday()));
        assertEquals(0, bd("200000").compareTo(dto.summary().collectedToday()));
        assertEquals(0, bd("502000").compareTo(dto.summary().receivable()));
    }

    @Test
    void paymentMustBePositive() {
        assertThrows(BusinessException.class,
                () -> service.addPayment(DAY, 7L, PaymentType.ABONO, BigDecimal.ZERO, null));
    }

    @Test
    void paymentRequiresExistingClient() {
        when(clientRepo.findById(9L)).thenReturn(Optional.empty());
        assertThrows(BusinessException.class,
                () -> service.addPayment(DAY, 9L, PaymentType.ABONO, bd("1000"), null));
        verify(paymentRepo, never()).save(any());
    }
}
