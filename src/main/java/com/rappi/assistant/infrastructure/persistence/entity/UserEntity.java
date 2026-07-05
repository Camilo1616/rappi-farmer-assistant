package com.rappi.assistant.infrastructure.persistence.entity;

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

    @Column(name = "account_status", length = 20)
    private String accountStatus;

    @Column(name = "nickname", length = 50)
    private String nickname;

    @Column(name = "avatar_url", length = 255)
    private String avatarUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    /** Última vez que el usuario hizo heartbeat (activo en la app). */
    @Column(name = "last_activity")
    private LocalDateTime lastActivity;

    /** ACTIVO | INACTIVO | DESACTIVADO */
    @Column(name = "activity_status", length = 20)
    private String activityStatus;

    /** Fecha en que el usuario activó la SIM de WhatsApp — controla el límite diario de envíos */
    @Column(name = "whatsapp_phone_registered_at")
    private LocalDate whatsappPhoneRegisteredAt;
}
