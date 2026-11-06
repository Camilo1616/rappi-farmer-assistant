package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@Entity
@Table(name = "discards")
public class DiscardEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "day")
    private LocalDate day;

    @Column(name = "category")
    private String category;

    @Column(name = "boxes")
    private Integer boxes;
}
