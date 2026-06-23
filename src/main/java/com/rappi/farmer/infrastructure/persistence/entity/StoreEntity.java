package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "stores")
public class StoreEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "store_code", unique = true, nullable = false, length = 50)
    private String storeCode;

    @Column(name = "brand_id", length = 50)
    private String brandId;

    @Column(name = "store_name", nullable = false, length = 150)
    private String storeName;

    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @Column(name = "backup_phone", length = 100)
    private String backupPhone;

    @Column(length = 50)
    private String channel;

    @Column(name = "onboarding_date")
    private LocalDate onboardingDate;

    @Column
    private Boolean active;

    @Column(name = "connection_percentage", precision = 5, scale = 2)
    private BigDecimal connectionPercentage;

    @Column(name = "current_status", length = 50)
    private String currentStatus;

    @Column(name = "had_handoff")
    private Boolean hadHandoff;

    @Column(name = "handoff_activated_at")
    private LocalDate handoffActivatedAt;

    @Column(name = "aging")
    private Integer aging;

    @Column(name = "aging_stage", length = 10)
    private String agingStage;

    @Column(name = "last_login_date")
    private LocalDate lastLoginDate;

    @Column(name = "gestionar", length = 5)
    private String gestionar;

    @Column(name = "upload_date")
    private LocalDate uploadDate;

    @Column(name = "credentials_date")
    private LocalDate credentialsDate;

    @Column(name = "last_follow_up")
    private LocalDate lastFollowUp;

    @Column(name = "follow_up_last_30d")
    private String followUpLast30d;

    @Column(name = "user_id", insertable = false, updatable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
