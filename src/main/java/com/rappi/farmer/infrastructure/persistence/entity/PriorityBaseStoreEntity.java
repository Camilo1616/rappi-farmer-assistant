package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "priority_base_stores")
public class PriorityBaseStoreEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "base_id", nullable = false)
    private PriorityBaseEntity base;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "farmer_id", nullable = false)
    private UserEntity farmer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private StoreEntity store;

    /** PENDIENTE, GESTIONADA, NO_CONTACTO */
    @Column(length = 20)
    private String status;

    @Column(name = "management_type", length = 30)
    private String managementType;

    @Column(columnDefinition = "text")
    private String comments;

    @Column(name = "managed_at")
    private LocalDateTime managedAt;
}
