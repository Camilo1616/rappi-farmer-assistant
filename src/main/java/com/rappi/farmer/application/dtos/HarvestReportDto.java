package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Reporte de un periodo: lo cosechado contra lo vendido, por categoria y por dia. */
public record HarvestReportDto(LocalDate from, LocalDate to, TotalsDto totals,
                               List<CategoryRowDto> categories, List<DayRowDto> days) {

    /** sellThroughPct = entregado / (arrastre inicial + cosechado). endingStock pasa al dia siguiente. */
    public record TotalsDto(int openingStock, int harvested, int ordered, int delivered, int discarded,
                            int endingStock, BigDecimal sales, int sellThroughPct) {}

    public record CategoryRowDto(String category, String label, int openingStock, int harvested, int delivered,
                                 int discarded, int endingStock, BigDecimal sales) {}

    public record DayRowDto(LocalDate date, int harvested, int delivered, int discarded, BigDecimal sales) {}
}
