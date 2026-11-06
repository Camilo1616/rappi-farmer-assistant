package com.rappi.farmer.application.dtos;

import java.time.LocalDate;
import java.util.List;

/** Reparto sugerido de la fresa disponible entre los pedidos abiertos (aun no aplicado). */
public record SuggestionDto(LocalDate date, List<Row> rows, int totalToGive, int totalUncovered) {

    /** give = cajas adicionales que se entregarian; uncovered = lo que quedaria sin cubrir del pedido. */
    public record Row(Long clientId, String name, String sector, String category, String label, int ordered,
                      int delivered, int give, int uncovered, boolean overdue) {}
}
