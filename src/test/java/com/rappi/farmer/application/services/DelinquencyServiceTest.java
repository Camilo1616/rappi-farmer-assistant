package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ClientDelinquency;
import com.rappi.farmer.application.dtos.PortfolioDto;
import com.rappi.farmer.application.dtos.PortfolioDto.*;
import com.rappi.farmer.infrastructure.persistence.repository.ClientPaymentJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.DispatchLineJpaRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DelinquencyServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 20);

    private static BigDecimal bd(String s) {
        return new BigDecimal(s);
    }

    @Test
    void ruleNeedsBalanceAndMoreThanFifteenDays() {
        assertTrue(DelinquencyService.isOverdue(bd("1"), 16));
        assertFalse(DelinquencyService.isOverdue(bd("1"), 15));
        assertFalse(DelinquencyService.isOverdue(BigDecimal.ZERO, 90));
        assertFalse(DelinquencyService.isOverdue(bd("-5"), 90));
        assertFalse(DelinquencyService.isOverdue(bd("1"), null));
    }

    private static ClientBalanceDto client(long id, String balance) {
        return new ClientBalanceDto(id, "C" + id, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, bd(balance), List.of());
    }

    @Test
    void measuresFromLastPaymentOrFirstPurchaseWhenNeverPaid() {
        PortfolioService portfolio = mock(PortfolioService.class);
        ClientPaymentJpaRepository payments = mock(ClientPaymentJpaRepository.class);
        DispatchLineJpaRepository lines = mock(DispatchLineJpaRepository.class);
        when(portfolio.getPortfolio(DAY)).thenReturn(new PortfolioDto(DAY, List.of(new SectorBalanceDto(1L, "S", List.of(
                client(1, "100"),    // pago hace 20 dias -> mora
                client(2, "100"),    // pago hace 3 dias -> al dia
                client(3, "100"),    // nunca pago, primera compra hace 30 dias -> mora
                client(4, "100"),    // nunca pago, primera compra ayer -> no mora
                client(5, "0")), BigDecimal.ZERO)), null));
        when(payments.lastCashInByClient(DAY)).thenReturn(List.of(
                new Object[]{1L, DAY.minusDays(20)}, new Object[]{2L, DAY.minusDays(3)}, new Object[]{5L, DAY.minusDays(90)}));
        when(lines.firstPurchaseByClient(DAY)).thenReturn(List.of(
                new Object[]{3L, DAY.minusDays(30)}, new Object[]{4L, DAY.minusDays(1)}));

        Map<Long, ClientDelinquency> m = new DelinquencyService(portfolio, payments, lines).infoByClient(DAY);
        assertTrue(m.get(1L).overdue());
        assertEquals(20, m.get(1L).daysSincePayment());
        assertFalse(m.get(2L).overdue());
        assertTrue(m.get(3L).overdue());
        assertNull(m.get(3L).daysSincePayment());
        assertFalse(m.get(4L).overdue());
        assertFalse(m.get(5L).overdue());   // sin saldo no hay mora
    }
}
