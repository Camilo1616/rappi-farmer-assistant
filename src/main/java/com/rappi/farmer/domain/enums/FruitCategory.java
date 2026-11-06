package com.rappi.farmer.domain.enums;

/** Categorias de fresa, en el orden en que se muestran en la tabla de despacho. */
public enum FruitCategory {
    JUMBO("Jumbo"), PRIMERA("Primera"), SEGUNDA("Segunda"), TERCERA("Tercera"),
    CUARTA("Cuarta"), QUINTA("Quinta"), MADURA("Madura"), BOLSAS("Bolsas");

    private final String label;

    FruitCategory(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
