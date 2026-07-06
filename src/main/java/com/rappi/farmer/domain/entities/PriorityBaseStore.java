package com.rappi.farmer.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriorityBaseStore {
    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

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

    public boolean isGestionada() {
        return "GESTIONADA".equals(status);
    }

    /** Actualiza la tipificación de la tienda; solo sella managedAt cuando el estado es terminal. */
    public void updateManagement(String newStatus, String newManagementType, String newComments) {
        status = newStatus;
        managementType = newManagementType;
        comments = newComments;
        if ("GESTIONADA".equals(newStatus) || "NO_CONTACTO".equals(newStatus)) {
            managedAt = LocalDateTime.now(BOGOTA);
        }
    }

    public static PriorityBaseStore pending(Long baseId, Long farmerId, Long storeId) {
        return new PriorityBaseStore(null, baseId, farmerId, null, storeId, null, null, null, null,
                "PENDIENTE", null, null, null);
    }
}
