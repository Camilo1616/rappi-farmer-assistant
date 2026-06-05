package com.rappi.farmer.application.dtos;

import lombok.Data;

import java.util.List;

@Data
public class CreatePriorityBaseRequest {
    private String baseType;
    private String message;
    private List<Long> farmerIds;
    /** Para baseType ACTIVE: 7 o 28 días. Ignorado en otros tipos. */
    private Integer activeDays;
    /** Para baseType CHURN: W1, W2, W3, M1, M2. */
    private String churnFilter;
}
