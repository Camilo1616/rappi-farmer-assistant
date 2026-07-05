package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentViewDto {
    private Long id;
    private Long baseId;
    private Long farmerId;
    private String farmerName;
    private String farmerCode;
    private String status;
    private String statusDisplay;
    private String comments;
    private LocalDateTime readAt;
    private LocalDateTime completedAt;
    private long totalTiendas;
    private long tiendasGestionadas;
    // Info de la base asociada
    private String baseType;
    private String baseTypeDisplay;
    private String baseMessage;
    private String liderName;
    private LocalDateTime baseCreatedAt;
}
