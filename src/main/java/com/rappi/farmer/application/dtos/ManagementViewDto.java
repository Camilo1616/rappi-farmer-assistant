package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ManagementViewDto {
    private Long id;
    private String storeName;
    private String storeCode;
    private String managementType;
    private String resultType;
    private String comments;
    private String managementTime;
}
