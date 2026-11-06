package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;

/** Estado de cartera de un cliente para alertas: saldo, dias de referencia sin pagar y si esta en mora. */
public record ClientDelinquency(BigDecimal balance, Integer daysSincePayment, boolean overdue) {

    public static final ClientDelinquency NONE = new ClientDelinquency(BigDecimal.ZERO, null, false);
}
