package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@Entity
@Table(name = "dispatch_lines")
public class DispatchLineEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "day")
    private LocalDate day;

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "category")
    private String category;

    @Column(name = "ordered_boxes")
    private Integer orderedBoxes;

    @Column(name = "delivered_boxes")
    private Integer deliveredBoxes;

    @Column(name = "unit_price")
    private BigDecimal unitPrice = BigDecimal.ZERO;
}
