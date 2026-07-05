package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Credencial única y compartida para leer/escribir el Google Sheet de Gestión AGM-IA.
 * Solo existe una fila (id=1) — la conecta un ADMIN una vez y todos los agentes la usan.
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "google_sheets_credential")
public class GoogleSheetsCredentialEntity {

    @Id
    private Long id;

    @Column(name = "refresh_token", length = 512, nullable = false)
    private String refreshToken;

    @Column(name = "connected_by_email", length = 100)
    private String connectedByEmail;

    @Column(name = "connected_at")
    private LocalDateTime connectedAt;
}
