package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Store {
    private static final BigDecimal ALIADOS_THRESHOLD = BigDecimal.valueOf(60);

    private Long id;
    private String storeCode;
    private String brandId;
    private String storeName;
    private String phoneNumber;
    private String backupPhone;
    private String channel;
    private LocalDate onboardingDate;
    private Boolean active;
    private BigDecimal connectionPercentage;
    private String currentStatus;
    private Boolean hadHandoff;
    private LocalDate handoffActivatedAt;
    private Long farmerId;
    private Integer aging;
    private String agingStage;
    private LocalDate lastLoginDate;
    private String gestionar;
    private LocalDate uploadDate;
    private String farmerEmail;
    private LocalDate credentialsDate;
    private LocalDate lastFollowUp;
    private String followUpLast30d;

    /**
     * Edad real de la tienda: días desde la primera FECHA DE CARGUE en que apareció.
     * Prioridad: upload_date (fuente de verdad) → onboarding_date (fallback) → aging del Excel (último recurso).
     */
    public int effectiveAging() {
        if (uploadDate != null) return (int) ChronoUnit.DAYS.between(uploadDate, LocalDate.now());
        if (onboardingDate != null) return (int) ChronoUnit.DAYS.between(onboardingDate, LocalDate.now());
        return aging != null ? aging : 0;
    }

    public boolean isSelfOnboarding() {
        return channel != null && channel.toLowerCase().contains("self");
    }

    public boolean isInsideSalesChannel() {
        return channel != null && channel.equalsIgnoreCase("Inside Sales");
    }

    /**
     * Hunting e Inside Sales: solo entran a onboarding si tuvieron handoff (TUVO_HANDOFF = SI).
     * Self (se registra solo): siempre entra a onboarding sin importar el handoff.
     */
    public boolean isOnboardingEligible() {
        if (channel == null) return true;
        String c = channel.toLowerCase().trim();
        if (c.contains("hunting") || c.contains("inside")) {
            return Boolean.TRUE.equals(hadHandoff);
        }
        return true;
    }

    /** IS = canal exacto "Inside Sales" + HO=NO (o nulo) + lastFollowUp nulo + followUpLast30d=NO + cargada ≤7 días. */
    public boolean isGestionarInsideSales(LocalDate today) {
        return isInsideSalesChannel()
                && !Boolean.TRUE.equals(hadHandoff)
                && lastFollowUp == null
                && "NO".equalsIgnoreCase(followUpLast30d)
                && uploadDate != null
                && !uploadDate.isBefore(today.minusDays(7));
    }

    /** Conexión efectiva: la de la métrica diaria si existe, si no la de la tienda. */
    public boolean isLowConnection(DailyMetric metric) {
        BigDecimal pct = metric != null && metric.getConnectionPercentage() != null
                ? metric.getConnectionPercentage()
                : connectionPercentage;
        return pct != null && pct.compareTo(ALIADOS_THRESHOLD) < 0;
    }

    /**
     * Churn: la columna "Estado Churn AVA" contiene "Churn", "Prevention W1/W2/W3"
     * y el último login fue hace ≤ 90 días (o no tiene fecha de login).
     * Devuelve la etiqueta o null si la tienda no está en riesgo.
     */
    public String churnLabel() {
        String label = detectChurnLabel(currentStatus);
        if (label == null) label = detectChurnLabel(gestionar);
        if (label == null) return null;

        if (lastLoginDate == null) return null;
        long dias = ChronoUnit.DAYS.between(lastLoginDate, LocalDate.now());
        if (dias > 90) return null;
        return label;
    }

    public boolean isChurnRisk() {
        return churnLabel() != null;
    }

    public Integer daysSinceLastLogin() {
        return lastLoginDate != null
                ? (int) ChronoUnit.DAYS.between(lastLoginDate, LocalDate.now())
                : null;
    }

    /** Extrae la etiqueta de churn de un texto, o null si no hay match. */
    private static String detectChurnLabel(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String up = raw.trim().toUpperCase();
        if (up.equals("CHURN") || up.startsWith("CHURN:") || up.startsWith("MAX RISK")) return "Churn";
        if (up.contains("PREVENTION W1") || up.contains("PREVENTION 1W")) return "Prevention W1";
        if (up.contains("PREVENTION W2") || up.contains("PREVENTION 2W")) return "Prevention W2";
        if (up.contains("PREVENTION W3") || up.contains("PREVENTION 3W")) return "Prevention W3";
        return null;
    }
}
