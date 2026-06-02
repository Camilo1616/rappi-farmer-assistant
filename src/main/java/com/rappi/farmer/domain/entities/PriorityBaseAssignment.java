package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriorityBaseAssignment {
    private Long id;
    private Long baseId;
    private Long farmerId;
    private String farmerName;
    private String farmerCode;
    private String status;
    private String comments;
    private LocalDateTime readAt;
    private LocalDateTime completedAt;
}
