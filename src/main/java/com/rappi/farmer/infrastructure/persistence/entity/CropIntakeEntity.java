package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@Entity
@Table(name = "crop_intakes")
public class CropIntakeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "day")
    private LocalDate day;

    @Column(name = "crop_id")
    private Long cropId;

    @Column(name = "category")
    private String category;

    @Column(name = "boxes")
    private Integer boxes;

    @Column(name = "unit_price")
    private BigDecimal unitPrice = BigDecimal.ZERO;
}
