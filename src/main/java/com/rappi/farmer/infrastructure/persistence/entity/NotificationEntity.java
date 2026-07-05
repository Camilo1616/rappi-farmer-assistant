package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "notifications")
public class NotificationEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    @Column(length = 30)
    private String type; // BASE_ASIGNADA, BASE_LEIDA, BASE_EN_PROCESO, BASE_COMPLETADA

    @Column(name = "reference_id")
    private Long referenceId; // base_id o assignment_id

    @Column(name = "is_read", nullable = false)
    private Boolean read = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
