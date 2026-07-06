package com.rappi.farmer.domain.entities;

import com.rappi.farmer.domain.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Management {
    private Long id;
    private Long storeId;
    private String storeName;
    private String storeCode;
    private Long userId;
    private String managementType;
    private String resultType;
    private String comments;
    private LocalDateTime managementDate;
    private String farmerName;
    private String farmerCode;
    private boolean brandSync; // true = registrada por propagación de hermana, no cuenta en métricas

    /** Nueva gestión registrada directamente por el farmer sobre su tienda. */
    public static Management register(Long storeId, Long userId, String managementType,
            String resultType, String comments, LocalDateTime when) {
        return new Management(null, storeId, null, null, userId,
                managementType, resultType, comments, when, null, null, false);
    }

    /** Copia propagada a una tienda hermana de la misma Brand ID — no cuenta en métricas propias. */
    public Management propagateTo(Long siblingStoreId) {
        return new Management(null, siblingStoreId, null, null, userId,
                managementType, resultType, comments, managementDate, null, null, true);
    }

    /** Solo se puede editar/eliminar el mismo día en que se registró. */
    public boolean isEditableToday(ZoneId zone) {
        return managementDate != null && managementDate.toLocalDate().equals(LocalDate.now(zone));
    }

    /** Solo el dueño de la gestión o un Líder/Administrador puede modificarla o borrarla. */
    public boolean canBeModifiedBy(Long actingUserId, UserRole actingRole) {
        boolean isManager = actingRole == UserRole.LIDER || actingRole == UserRole.ADMIN;
        return isManager || (actingUserId != null && actingUserId.equals(userId));
    }

    /** Las gestiones propagadas a tiendas hermanas (brandSync) no cuentan en las métricas del farmer. */
    public boolean countsTowardMetrics() {
        return !brandSync;
    }
}
