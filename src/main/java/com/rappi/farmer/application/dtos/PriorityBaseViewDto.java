package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriorityBaseViewDto {
    private Long id;
    private String baseType;
    private String baseTypeDisplay;
    private String message;
    private String liderName;
    private LocalDateTime createdAt;
    private int totalFarmers;
    private int completados;
    private int enProceso;
    private int pendientes;
    private int totalTiendas;
    private int tiendasGestionadas;
}
