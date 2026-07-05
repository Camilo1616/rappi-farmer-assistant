package com.rappi.assistant.domain.enums;

public enum RappiCountry {
    CO("Colombia"),
    MX("México"),
    AR("Argentina"),
    PE("Perú"),
    BR("Brasil"),
    EC("Ecuador"),
    CL("Chile"),
    CR("Costa Rica"),
    UY("Uruguay"),
    BO("Bolivia"),
    PA("Panamá"),
    HN("Honduras");

    private final String nombre;

    RappiCountry(String nombre) { this.nombre = nombre; }

    public String getNombre() { return nombre; }

    @Override
    public String toString() { return name() + " — " + nombre; }
}
