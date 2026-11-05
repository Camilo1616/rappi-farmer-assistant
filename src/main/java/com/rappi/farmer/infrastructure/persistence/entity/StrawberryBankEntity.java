package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Banco de fresas: fila única (id = 1) con el stock disponible en kg. */
@Data
@NoArgsConstructor
@Entity
@Table(name = "strawberry_bank")
public class StrawberryBankEntity {
    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id;

    @Column(name = "quantity_kg", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantityKg = BigDecimal.ZERO;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
