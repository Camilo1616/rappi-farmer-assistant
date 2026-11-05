package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Venta. Estados: PENDIENTE -> CONFIRMADA -> PEDIDO_CREADO. */
@Data
@NoArgsConstructor
@Entity
@Table(name = "sales")
public class SaleEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_name", nullable = false, length = 200)
    private String customerName;

    @Column(name = "quantity_kg", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantityKg;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "crop_id")
    private Long cropId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
