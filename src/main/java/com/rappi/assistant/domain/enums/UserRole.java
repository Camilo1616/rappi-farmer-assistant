package com.rappi.assistant.domain.enums;

public enum UserRole {
    ADMIN,
    USER;

    public String displayName() {
        return switch (this) {
            case ADMIN -> "Administrador";
            case USER  -> "Usuario";
        };
    }
}
