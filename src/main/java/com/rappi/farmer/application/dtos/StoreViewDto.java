package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
public class StoreViewDto {
    private Long id;
    private String storeCode;
    private String brandId;
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
    /** Último login del aliado en la plataforma (de la columna "Último Login" del Excel). */
    private LocalDate lastLoginDate;
    /** Días transcurridos desde el último login. Null si no hay fecha. */
    private Integer diasSinLogin;
    /** Etapa del aliado según columna AGING del Excel: M1, M2, M2+, NEW, etc. */
    private String agingStage;
    /** Estado de churn de la tienda: "Churn", "Prevention W1", "Prevention W2", "Prevention W3". Null si no aplica. */
    private String churnLabel;
    /** Estado AVA del Excel: "Churn Ava" (crítico) o "Disminuye" (bajando). Null si no aplica. */
    private String avaLabel;
    /** Email del farmer asignado a esta tienda. */
    private String farmerEmail;
    /** ID del farmer asignado a esta tienda. */
    private Long farmerId;
    /** AVA_MTD: porcentaje de AVA del mes actual. */
    private BigDecimal avaMtd;
    /** AVA_L4W: porcentaje de AVA últimas 4 semanas (= connectionPercentage). */
    private BigDecimal avaL4w;
    /** AVA_L7D: porcentaje de AVA últimos 7 días. */
    private BigDecimal avaL7d;
    /** Sección del dashboard donde clasifica esta tienda. */
    private String dashboardSegment;
    /** Texto del último contacto: tipo, resultado y fecha. */
    private String lastContact;
    /** Canal de adquisición: Hunting, Inside Sales, Self. */
    private String channel;
    /** Fecha de credenciales de la tienda en la plataforma Rappi. */
    private LocalDate credentialsDate;
}
