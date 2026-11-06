package com.rappi.farmer.application.dtos;

import java.time.LocalDateTime;

/** Usuario del panel de ventas para la pantalla "Usuarios y roles". Nunca incluye la contraseña. */
public record PanelUserDto(Long id, String fullName, String email, String role, String roleLabel, boolean active,
                           boolean mustChangePassword, LocalDateTime lastLoginAt, boolean canManage) {}
