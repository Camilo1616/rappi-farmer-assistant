package com.rappi.farmer.domain.enums;

public enum AssignmentStatus {
    PENDIENTE,
    LEIDA,
    EN_PROCESO,
    COMPLETADA;

    public String displayName() {
        return switch (this) {
            case PENDIENTE  -> "Pendiente";
            case LEIDA      -> "Leída";
            case EN_PROCESO -> "En proceso";
            case COMPLETADA -> "Completada";
        };
    }
}
