package com.rappi.farmer.domain.enums;

public enum BaseType {
    CHURN,
    ACTIVE_F7D,
    RETENCION,
    AVA_8_14,
    OTRO;

    public String displayName() {
        return switch (this) {
            case CHURN      -> "Churn";
            case ACTIVE_F7D -> "Active F7D";
            case RETENCION  -> "Prioridad Retención";
            case AVA_8_14   -> "AVA 8-14";
            case OTRO       -> "Otro";
        };
    }
}
