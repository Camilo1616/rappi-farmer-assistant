package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Utilidad = ventas + fletes cobrados - costo de cultivos - gastos de viaje.
 * No incluye arriendo, luz, internet ni personal (igual que el cuaderno de Angela).
 */
public record ProfitDto(LocalDate from, LocalDate to, TotalsDto totals, List<DayDto> days) {

    public record TotalsDto(BigDecimal sales, BigDecimal freightIncome, BigDecimal cropCost,
                            BigDecimal tripExpenses, BigDecimal profit) {}

    public record DayDto(LocalDate date, BigDecimal sales, BigDecimal freightIncome, BigDecimal cropCost,
                         BigDecimal tripExpenses, BigDecimal profit) {}
}
