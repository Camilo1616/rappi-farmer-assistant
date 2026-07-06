package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.ZoneId;

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

    public boolean belongsTo(Long candidateLiderId) {
        return liderId != null && liderId.equals(candidateLiderId);
    }

    public static PriorityBase create(Long liderId, String baseType, String message) {
        return new PriorityBase(null, liderId, null, baseType, message,
                LocalDateTime.now(ZoneId.of("America/Bogota")));
    }
}
