package com.rappi.farmer.domain.exceptions;

/** Se lanza al intentar entregar mas cajas de una categoria de las que hay en stock. */
public class InsufficientStockException extends BusinessException {
    private final int maxAllowed;

    public InsufficientStockException(String categoryLabel, int maxAllowed) {
        super("Solo hay " + maxAllowed + " caja(s) de " + categoryLabel + " disponibles");
        this.maxAllowed = maxAllowed;
    }

    public int getMaxAllowed() {
        return maxAllowed;
    }
}
