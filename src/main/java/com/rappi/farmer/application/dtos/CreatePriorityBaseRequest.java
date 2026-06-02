package com.rappi.farmer.application.dtos;

import lombok.Data;

import java.util.List;

@Data
public class CreatePriorityBaseRequest {
    private String baseType;
    private String message;
    private List<Long> farmerIds;
}
