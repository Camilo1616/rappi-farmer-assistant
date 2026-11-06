package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Cartera (cuentas por cobrar) a una fecha: saldo por cliente, por sector y resumen de dinero. */
public record PortfolioDto(LocalDate date, List<SectorBalanceDto> sectors, SummaryDto summary) {

    public record PaymentDto(Long id, String type, String label, BigDecimal amount, String note) {}

    /** saldo = openingBalance + billed - discounts - payments - deposits (positivo = el cliente debe). */
    public record ClientBalanceDto(Long id, String name, BigDecimal openingBalance, BigDecimal billed,
                                   BigDecimal discounts, BigDecimal payments, BigDecimal deposits,
                                   BigDecimal balance, List<PaymentDto> todayPayments) {}

    public record SectorBalanceDto(Long id, String name, List<ClientBalanceDto> clients, BigDecimal balance) {}

    /** salesToday: facturado del dia; collectedToday: dinero que entro (abonos + consignaciones). */
    public record SummaryDto(BigDecimal salesToday, BigDecimal collectedToday, BigDecimal discountsToday,
                             BigDecimal receivable) {}
}
