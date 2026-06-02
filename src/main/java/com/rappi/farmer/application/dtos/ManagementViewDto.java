package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManagementViewDto {
    private Long id;
    private String storeName;
    private String storeCode;
    private String managementType;
    private String resultType;
    private String comments;
    private String managementTime;
    private String farmerName;
    private String farmerCode;
    private Boolean hadHandoff;
}
