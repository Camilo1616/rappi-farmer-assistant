package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@Entity
@Table(name = "category_prices")
public class CategoryPriceEntity {
    @Id
    @Column(name = "category")
    private String category;

    @Column(name = "price")
    private BigDecimal price = BigDecimal.ZERO;
}
