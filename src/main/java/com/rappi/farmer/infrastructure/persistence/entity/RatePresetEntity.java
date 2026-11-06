package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Entity
@Table(name = "rate_presets")
public class RatePresetEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "kind")
    private String kind;

    @Column(name = "concept")
    private String concept;

    @Column(name = "unit_amount")
    private BigDecimal unitAmount;

    @Column(name = "per_box")
    private Boolean perBox = false;
}
