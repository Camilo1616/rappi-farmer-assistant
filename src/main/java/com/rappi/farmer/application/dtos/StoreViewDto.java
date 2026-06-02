package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class StoreViewDto {
    private Long id;
    private String storeCode;
    private String storeName;
    private String phoneNumber;
    private int aging;
    private Integer ordersL4W;
    private BigDecimal connectionPercentage;
    private String currentStatus;
    private String tendencia;
    /** Resultado de la última gestión registrada hoy. Null si aún no fue gestionada. */
    private String todayManagementResult;
    /** Segmento de prioridad (solo se usa en la sección Recomendado Hoy). */
    private String segmento;
    private Boolean hadHandoff;
}
