package com.rappi.farmer.domain.enums;

public enum UserStatus {
    ACTIVE("Activo"),
    SUSPENDED("Suspendido"),
    CLOSED("Cerrado");

    private final String label;

    UserStatus(String label) { this.label = label; }

    public String getLabel() { return label; }
}
