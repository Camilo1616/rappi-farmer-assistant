package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "daily_metrics")
public class DailyMetricEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private StoreEntity store;

    @Column(name = "metric_date", nullable = false)
    private LocalDate metricDate;

    @Column
    private Integer sales;

    @Column(name = "connection_percentage", precision = 5, scale = 2)
    private BigDecimal connectionPercentage;

    @Column(name = "rappi_allies_connected")
    private Boolean rappiAlliesConnected;

    @Column(name = "orders_count")
    private Integer ordersCount;

    @Column(name = "ava_l7d", precision = 5, scale = 2)
    private BigDecimal avaL7d;

    /** Estado original de Rappi: "Mejora", "Disminuye", "Estable", etc. */
    @Column(name = "ava_status", length = 50)
    private String avaStatus;

    @Column(name = "ava_mtd", precision = 5, scale = 2)
    private BigDecimal avaMtd;
}
