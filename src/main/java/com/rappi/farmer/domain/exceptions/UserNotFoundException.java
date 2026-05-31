package com.rappi.farmer.domain.exceptions;

public class UserNotFoundException extends BusinessException {
    public UserNotFoundException(Long id) {
        super("Usuario con ID " + id + " no encontrado");
    }
}
