package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Management {
    private Long id;
    private Long storeId;
    private String storeName;
    private String storeCode;
    private Long userId;
    private String managementType;
    private String resultType;
    private String comments;
    private LocalDateTime managementDate;
    private String farmerName;
    private String farmerCode;
    private boolean brandSync; // true = registrada por propagación de hermana, no cuenta en métricas
}
