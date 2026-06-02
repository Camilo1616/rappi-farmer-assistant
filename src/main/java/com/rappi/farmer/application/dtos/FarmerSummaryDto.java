package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class FarmerSummaryDto {
    private Long id;
    private String farmerCode;
    private String fullName;
    private String email;
    private String countryCode;
    private String accountStatus;
    // Métricas de hoy
    private long gestionesHoy;
    private long exitosasHoy;
    private long noContactoHoy;
    // Cartera
    private long totalStores;
    private long onboardingCount;
    private long churnCount;
    private long saludablesCount;
}
