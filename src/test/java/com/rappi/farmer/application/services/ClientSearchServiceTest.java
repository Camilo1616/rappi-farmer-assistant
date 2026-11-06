package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ClientSearchResultDto;
import com.rappi.farmer.application.dtos.PortfolioDto;
import com.rappi.farmer.application.dtos.PortfolioDto.*;
import com.rappi.farmer.infrastructure.persistence.entity.ClientPaymentEntity;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClientSearchServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 6);
    private DispatchLineJpaRepository lineRepo;
    private ClientPaymentJpaRepository paymentRepo;
    private ClientSearchService service;

    private static ClientBalanceDto client(long id, String name, String balance) {
        return new ClientBalanceDto(id, name, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, new BigDecimal(balance), List.of());
    }

    @BeforeEach
    void setUp() {
        PortfolioService portfolio = mock(PortfolioService.class);
        lineRepo = mock(DispatchLineJpaRepository.class);
        paymentRepo = mock(ClientPaymentJpaRepository.class);
        service = new ClientSearchService(portfolio, lineRepo, paymentRepo);
        when(portfolio.getPortfolio(DAY)).thenReturn(new PortfolioDto(DAY, List.of(
                new SectorBalanceDto(1L, "Pereira Mercasa", List.of(
                        client(1, "Valentina", "100000"), client(2, "Andrés", "900000")), BigDecimal.ZERO),
                new SectorBalanceDto(2L, "Pereira Impala", List.of(client(3, "Jhon", "500000")), BigDecimal.ZERO)),
                null));
        when(lineRepo.lastPurchases(any(), any(), any())).thenReturn(List.of());
        when(paymentRepo.findTop3ByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any())).thenReturn(List.of());
    }

    @Test
    void matchesIgnoringAccentsAndCase() {
        List<ClientSearchResultDto> r = service.search("ANDRES", DAY);
        assertEquals(1, r.size());
        assertEquals("Andrés", r.get(0).name());
    }

    @Test
    void matchesBySectorName() {
        assertEquals(1, service.search("impala", DAY).size());
    }

    @Test
    void emptyQueryReturnsBiggestDebtorsFirst() {
        List<ClientSearchResultDto> r = service.search("", DAY);
        assertEquals(List.of("Andrés", "Jhon", "Valentina"), r.stream().map(ClientSearchResultDto::name).toList());
    }

    @Test
    void includesLastPurchaseAndPayments() {
        when(lineRepo.lastPurchases(eq(2L), any(), any())).thenReturn(
                List.<Object[]>of(new Object[]{DAY.minusDays(3), 9L, new BigDecimal("702000")}));
        ClientPaymentEntity p = new ClientPaymentEntity();
        p.setDay(DAY.minusDays(1));
        p.setType("ABONO");
        p.setAmount(new BigDecimal("200000"));
        p.setNote("Efectivo");
        when(paymentRepo.findTop3ByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(eq(2L), any())).thenReturn(List.of(p));

        ClientSearchResultDto c = service.search("andres", DAY).get(0);
        assertEquals(3, c.daysSincePurchase());
        assertEquals(9, c.lastPurchase().boxes());
        assertEquals("Abono", c.lastPayments().get(0).label());
    }
}
