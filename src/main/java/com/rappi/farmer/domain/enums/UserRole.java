package com.rappi.farmer.domain.enums;

public enum UserRole {
    ADMIN,
    LIDER,
    COORDINATOR,
    FARMER_MASS,
    DUENA,
    ASISTENTE;

    public String displayName() {
        return switch (this) {
            case ADMIN       -> "Administrador";
            case LIDER       -> "Líder";
            case COORDINATOR -> "Coordinador";
            case FARMER_MASS -> "Farmer Mass";
            case DUENA       -> "Dueña";
            case ASISTENTE   -> "Asistente de cartera";
        };
    }

    public boolean canImport() {
        return this == LIDER || this == FARMER_MASS || this == COORDINATOR;
    }
}
