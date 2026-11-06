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

    /** Roles del panel de ventas (despacho y cartera); no pertenecen a Rappi, así que pueden usar cualquier correo. */
    public boolean isPanelRole() {
        return this == DUENA || this == ASISTENTE;
    }

    public boolean canImport() {
        return this == LIDER || this == FARMER_MASS || this == COORDINATOR;
    }
}
