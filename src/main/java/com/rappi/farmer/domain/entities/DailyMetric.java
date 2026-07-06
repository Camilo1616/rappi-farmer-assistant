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

    /** Normaliza un valor que puede venir en escala 0-1 (decimal) o 0-100 (porcentaje) a 0-100. */
    public static BigDecimal toPercent(BigDecimal val) {
        if (val == null) return BigDecimal.ZERO;
        return val.compareTo(BigDecimal.ONE) <= 0
                ? val.multiply(BigDecimal.valueOf(100))
                : val;
    }

    public BigDecimal avaMtdPercent() { return toPercent(avaMtd); }
    public BigDecimal avaL7dPercent() { return toPercent(avaL7d); }
    public BigDecimal connectionPercentagePercent() { return toPercent(connectionPercentage); }
}
