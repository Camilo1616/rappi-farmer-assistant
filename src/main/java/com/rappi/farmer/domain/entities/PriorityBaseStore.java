package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriorityBaseStore {
    private Long id;
    private Long baseId;
    private Long farmerId;
    private String farmerName;
    private Long storeId;
    private String storeCode;
    private String storeName;
    private String phoneNumber;
    private String currentStatus;
    private String status;
    private String managementType;
    private String comments;
    private LocalDateTime managedAt;
}
