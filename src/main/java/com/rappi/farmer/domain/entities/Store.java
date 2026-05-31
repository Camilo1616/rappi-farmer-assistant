package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Store {
    private Long id;
    private String storeCode;
    private String storeName;
    private String phoneNumber;
    private String channel;
    private LocalDate onboardingDate;
    private Boolean active;
    private BigDecimal connectionPercentage;
    private String currentStatus;
    private Boolean hadHandoff;
}
