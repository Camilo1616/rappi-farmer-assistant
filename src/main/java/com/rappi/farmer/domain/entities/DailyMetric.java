package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailyMetric {
    private Long id;
    private Long storeId;
    private LocalDate metricDate;
    private Integer sales;
    private BigDecimal connectionPercentage;
    private Boolean rappiAlliesConnected;
    private Integer ordersCount;
    private BigDecimal avaL7d;
    private String avaStatus;
    private BigDecimal avaMtd;
}
