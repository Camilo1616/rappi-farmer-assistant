package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Entity
@Table(name = "trip_entries")
public class TripEntryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "trip_id")
    private Long tripId;

    @Column(name = "type")
    private String type;

    @Column(name = "concept")
    private String concept;

    @Column(name = "boxes")
    private Integer boxes;

    @Column(name = "unit_amount")
    private BigDecimal unitAmount;

    @Column(name = "amount")
    private BigDecimal amount = BigDecimal.ZERO;
}
