package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Entity
@Table(name = "dispatch_clients")
public class DispatchClientEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "sector_id")
    private Long sectorId;

    @Column(name = "name")
    private String name;

    @Column(name = "opening_balance")
    private BigDecimal openingBalance = BigDecimal.ZERO;

    @Column(name = "opening_packaging")
    private Integer openingPackaging = 0;

    @Column(name = "phone")
    private String phone;

    @Column(name = "plaza")
    private String plaza;
}
