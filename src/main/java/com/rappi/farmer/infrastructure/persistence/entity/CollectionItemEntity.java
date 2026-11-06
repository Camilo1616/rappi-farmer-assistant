package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Entity
@Table(name = "collection_items")
public class CollectionItemEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "run_id")
    private Long runId;

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "owed_snapshot")
    private BigDecimal owedSnapshot = BigDecimal.ZERO;

    @Column(name = "packaging_snapshot")
    private Integer packagingSnapshot = 0;

    @Column(name = "added_manually")
    private Boolean addedManually = false;

    @Column(name = "needs_review")
    private Boolean needsReview = false;

    @Column(name = "resolution")
    private String resolution;
}
