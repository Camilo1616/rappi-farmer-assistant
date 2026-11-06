package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Pedidos abiertos del dia consolidados contra la fresa disponible.
 * pending = pedido - entregado (solo lo que falta); free = fresa que queda; shortage = lo que no se alcanza a cubrir.
 */
public record OpenOrdersDto(LocalDate date, List<CategoryRow> categories, List<ClientRow> clients,
                            List<OverdueRow> overdue, SummaryDto summary) {

    public record CategoryRow(String category, String label, int supply, int ordered, int delivered, int pending,
                              int free, int shortage, int surplus) {}

    public record PendingLine(String category, String label, int pending) {}

    public record ClientRow(Long clientId, String name, String sector, boolean overdue, BigDecimal balance,
                            int pending, List<PendingLine> lines) {}

    public record OverdueRow(Long clientId, String name, String sector, BigDecimal balance,
                             Integer daysSincePayment, int pendingBoxes) {}

    public record SummaryDto(int ordered, int delivered, int pending, int shortage) {}
}
