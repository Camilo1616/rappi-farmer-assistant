package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Registra qué filas del sheet "soporte" ya se detectaron al menos una vez, para que el job de
 * sync (AgmSyncService) pueda distinguir filas realmente nuevas de las que llevan tiempo pendientes.
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "agm_seen_rows")
public class AgmSeenRowEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "store_id", length = 100, nullable = false)
    private String storeId;

    @Column(name = "row_number", nullable = false, unique = true)
    private Integer rowNumber;

    @Column(name = "first_seen_at")
    private LocalDateTime firstSeenAt;
}
