package com.rappi.farmer.domain.exceptions;

/** Se lanza al crear un pedido cuando el banco no tiene fresas suficientes. */
public class InsufficientStrawberriesException extends BusinessException {
    public InsufficientStrawberriesException() {
        super("No hay fresas en el banco");
    }
}
