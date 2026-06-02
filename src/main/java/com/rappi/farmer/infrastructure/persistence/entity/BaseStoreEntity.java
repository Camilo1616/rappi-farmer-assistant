package com.rappi.farmer.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "base_stores")
public class BaseStoreEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "base_id", nullable = false)
    private Long baseId;

    @Column(name = "store_id", nullable = false)
    private Long storeId;
}
