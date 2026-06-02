package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriorityBase {
    private Long id;
    private Long liderId;
    private String liderName;
    private String baseType;
    private String message;
    private LocalDateTime createdAt;
}
