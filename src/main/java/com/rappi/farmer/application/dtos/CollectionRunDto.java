package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Hoja de cobro de un conductor: a quien se le manda a cobrar, lo que cobro (por metodo),
 * las diferencias por aclarar y la entrega del efectivo.
 */
public record CollectionRunDto(Long id, LocalDate day, String driverName, String destination, Long tripId,
                               boolean closed, List<ItemDto> items, TotalsDto totals, HandoverDto handover) {

    public record PaymentLineDto(Long id, String label, String method, BigDecimal amount, String receivedBy, String note) {}

    public record EmptiesDto(Long id, int boxes) {}

    /**
     * owed/packaging: lo que debia al armar la hoja. remaining = owed - collected - discounts.
     * needsClarification: pago menor a lo que debia y aun no se dijo si queda debiendo, descuento o faltante.
     */
    public record ItemDto(Long id, Long clientId, String name, String sector, BigDecimal owed, int packaging,
                          boolean addedManually, boolean needsReview, String resolution,
                          BigDecimal collected, BigDecimal discounts, BigDecimal remaining, String status,
                          boolean needsClarification, List<PaymentLineDto> payments, List<EmptiesDto> empties,
                          int emptiesReturned) {}

    public record TotalsDto(BigDecimal owed, BigDecimal collected, BigDecimal cash, BigDecimal nequi,
                            BigDecimal deposit, BigDecimal discounts, BigDecimal remaining, int emptiesReturned,
                            int pendingClarifications, int reviews) {}

    /** cashExpected = efectivo cobrado - gastos del viaje; difference = entregado - esperado (negativo = faltante). */
    public record HandoverDto(BigDecimal cash, BigDecimal tripExpenses, BigDecimal cashExpected,
                              BigDecimal handedAmount, String handedTo, BigDecimal difference) {}
}
