package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@Entity
@Table(name = "packaging_returns")
public class PackagingReturnEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "day")
    private LocalDate day;

    @Column(name = "boxes")
    private Integer boxes;

    @Column(name = "run_id")
    private Long runId;

    @Column(name = "note")
    private String note;
}
