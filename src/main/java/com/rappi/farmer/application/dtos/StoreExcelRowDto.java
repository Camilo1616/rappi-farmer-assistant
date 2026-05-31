package com.rappi.farmer.application.dtos;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class StoreExcelRowDto {
    private String storeCode;
    private String storeName;
    private String phoneNumber;
    private String channel;
    private LocalDate onboardingDate;
    private BigDecimal connectionPercentage;
    private String currentStatus;
    private Integer ordersL4W;
    private Integer aging;
    private String avaStatus;
    private BigDecimal avaL7d;
    private Boolean hadHandoff;
}
