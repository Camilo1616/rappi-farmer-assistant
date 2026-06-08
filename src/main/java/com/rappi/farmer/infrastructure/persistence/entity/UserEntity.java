package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(length = 100, unique = true)
    private String email;

    @Column(length = 255)
    private String password;

    @Column(length = 50)
    private String role;

    @Column(name = "farmer_code", length = 20)
    private String farmerCode;

    @Column(name = "country_code", length = 100)
    private String countryCode;

    @Column(name = "account_status", length = 20)
    private String accountStatus;

    @Column(name = "lider_id")
    private Long liderId;

    @Column(name = "nickname", length = 50)
    private String nickname;

    @Column(name = "avatar_url", length = 255)
    private String avatarUrl;

    @Column(name = "calendar_refresh_token", length = 512)
    private String calendarRefreshToken;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "last_import_date")
    private LocalDate lastImportDate;
}
