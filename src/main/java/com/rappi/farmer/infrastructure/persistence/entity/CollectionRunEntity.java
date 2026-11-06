package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@Entity
@Table(name = "collection_runs")
public class CollectionRunEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "day")
    private LocalDate day;

    @Column(name = "driver_name")
    private String driverName;

    @Column(name = "destination")
    private String destination;

    @Column(name = "trip_id")
    private Long tripId;

    @Column(name = "handed_amount")
    private BigDecimal handedAmount;

    @Column(name = "handed_to")
    private String handedTo;

    @Column(name = "closed")
    private Boolean closed = false;

    @Column(name = "notes")
    private String notes;
}
