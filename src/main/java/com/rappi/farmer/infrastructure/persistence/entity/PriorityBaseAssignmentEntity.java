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
@Table(name = "priority_base_assignments")
public class PriorityBaseAssignmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "base_id", nullable = false)
    private PriorityBaseEntity base;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "farmer_id", nullable = false)
    private UserEntity farmer;

    @Column(length = 20)
    private String status;

    @Column(columnDefinition = "text")
    private String comments;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
