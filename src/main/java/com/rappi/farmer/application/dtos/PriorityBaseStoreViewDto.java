package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriorityBaseStoreViewDto {
    private Long id;
    private Long baseId;
    private Long storeId;
    private String farmerName;
    private String storeCode;
    private String storeName;
    private String phoneNumber;
    private String currentStatus;
    private String status;
    private String managementType;
    private String comments;
    private LocalDateTime managedAt;
}
