package com.rappi.farmer.domain.enums;

/** Movimientos que bajan el saldo de un cliente. */
public enum PaymentType {
    ABONO("Abono"), CONSIGNACION("Consignación"), DESCUENTO("Descuento"), FALTANTE("Faltante");

    private final String label;

    PaymentType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** Abonos y consignaciones son dinero que entra; descuento y faltante solo reducen la deuda. */
    public boolean isCashIn() {
        return this == ABONO || this == CONSIGNACION;
    }
}
