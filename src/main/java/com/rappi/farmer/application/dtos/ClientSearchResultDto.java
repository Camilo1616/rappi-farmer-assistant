package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Ficha corta de un cliente para el buscador. */
public record ClientSearchResultDto(Long id, String name, String sector, BigDecimal balance,
                                    BigDecimal openingBalance, LastPurchaseDto lastPurchase,
                                    Integer daysSincePurchase, List<LastPaymentDto> lastPayments) {

    public record LastPurchaseDto(LocalDate date, int boxes, BigDecimal total) {}

    public record LastPaymentDto(LocalDate date, String label, BigDecimal amount, String note) {}
}
