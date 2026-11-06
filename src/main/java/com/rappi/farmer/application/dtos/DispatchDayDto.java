package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Vista completa de un dia de despacho: stock, clientes por sector y resumen de cierre. */
public record DispatchDayDto(LocalDate date, List<StockDto> stock, List<SectorDto> sectors, SummaryDto summary) {

    /** Stock de una categoria: arrastre + cosecha (manual + cultivos) - entregado - descarte. */
    public record StockDto(String category, String label, int carryover, int harvested,
                           int delivered, int discarded, int available, BigDecimal price,
                           int cultivoHarvested) {}

    public record LineDto(String category, int ordered, int delivered, BigDecimal unitPrice) {}

    public record ClientDto(Long id, String name, BigDecimal openingBalance, List<LineDto> lines,
                            int orderedBoxes, int deliveredBoxes, BigDecimal invoiceTotal) {}

    public record SectorDto(Long id, String name, List<ClientDto> clients,
                            int orderedBoxes, int deliveredBoxes, BigDecimal invoiceTotal) {}

    /** Cosechado contra vendido; {@code leftoverBoxes} pasa al dia siguiente y sale primero. */
    public record SummaryDto(int carryoverBoxes, int harvestedBoxes, int deliveredBoxes,
                             int discardedBoxes, int leftoverBoxes, BigDecimal salesTotal) {}
}
