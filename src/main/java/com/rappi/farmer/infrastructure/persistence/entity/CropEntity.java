package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Cultivo de fresas; acumula los kg cosechados que alimentan el banco. */
@Data
@NoArgsConstructor
@Entity
@Table(name = "crops")
public class CropEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 200)
    private String location;

    @Column(name = "harvested_kg", nullable = false, precision = 10, scale = 2)
    private BigDecimal harvestedKg = BigDecimal.ZERO;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
