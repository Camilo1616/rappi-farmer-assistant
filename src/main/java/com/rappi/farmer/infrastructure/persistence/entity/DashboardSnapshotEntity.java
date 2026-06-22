package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "dashboard_snapshots",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "snapshot_date"}))
public class DashboardSnapshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "json_data", columnDefinition = "LONGTEXT", nullable = false)
    private String jsonData;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
