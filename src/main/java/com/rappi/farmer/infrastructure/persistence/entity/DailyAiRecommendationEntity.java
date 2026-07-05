package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_ai_recommendations",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "rec_date"}))
@Data
@NoArgsConstructor
public class DailyAiRecommendationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "rec_date", nullable = false)
    private LocalDate recDate;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    /** JSON array de priorities: [{storeCode, storeName, priority, reason, action}] */
    @Column(name = "priorities_json", columnDefinition = "LONGTEXT")
    private String prioritiesJson;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
