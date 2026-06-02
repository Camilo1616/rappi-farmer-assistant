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
@Table(name = "priority_bases")
public class PriorityBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lider_id", nullable = false)
    private UserEntity lider;

    @Column(name = "base_type", nullable = false, length = 30)
    private String baseType;

    @Column(columnDefinition = "text", nullable = false)
    private String message;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
