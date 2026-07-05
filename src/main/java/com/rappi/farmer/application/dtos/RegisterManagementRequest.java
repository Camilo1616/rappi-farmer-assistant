package com.rappi.farmer.application.dtos;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RegisterManagementRequest {
    private Long storeId;
    private String managementType;
    private String resultType;
    private String comments;
}
