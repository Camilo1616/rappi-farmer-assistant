package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "bases")
public class BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 30)
    private String type; // ACTIVE_F7D, CHURN, RETENCION, AVA_8_14, PRIORIZACION

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "lider_id", nullable = false)
    private Long liderId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
