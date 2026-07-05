package com.rappi.assistant.domain.exceptions;

public class UserNotFoundException extends BusinessException {
    public UserNotFoundException(Long id) {
        super("Usuario con ID " + id + " no encontrado");
    }
}
