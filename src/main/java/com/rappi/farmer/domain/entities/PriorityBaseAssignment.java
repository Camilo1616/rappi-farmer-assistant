package com.rappi.farmer.domain.entities;

import com.rappi.farmer.domain.enums.AssignmentStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriorityBaseAssignment {
    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

    private Long id;
    private Long baseId;
    private Long farmerId;
    private String farmerName;
    private String farmerCode;
    private String status;
    private String comments;
    private LocalDateTime readAt;
    private LocalDateTime completedAt;

    /** Avanza a EN_PROCESO — solo permitido desde PENDIENTE o LEIDA (nunca retrocede). */
    public void markEnProceso() {
        if (AssignmentStatus.PENDIENTE.name().equals(status) || AssignmentStatus.LEIDA.name().equals(status)) {
            status = AssignmentStatus.EN_PROCESO.name();
            if (readAt == null) readAt = LocalDateTime.now(BOGOTA);
        }
    }

    /** Transición genérica de estado, con sellado de readAt/completedAt según corresponda. */
    public void transitionTo(AssignmentStatus newStatus, String newComments) {
        status = newStatus.name();
        if (newComments != null) comments = newComments;
        if (newStatus == AssignmentStatus.LEIDA && readAt == null) readAt = LocalDateTime.now(BOGOTA);
        if (newStatus == AssignmentStatus.COMPLETADA) completedAt = LocalDateTime.now(BOGOTA);
    }

    public boolean hasStatus(AssignmentStatus s) {
        return s.name().equals(status);
    }

    /** true si pasó a LEIDA o COMPLETADA dentro de la ventana reciente (para notificar al líder). */
    public boolean recentlyActive(LocalDateTime since) {
        return (hasStatus(AssignmentStatus.LEIDA) || hasStatus(AssignmentStatus.COMPLETADA))
                && readAt != null && readAt.isAfter(since);
    }

    public static PriorityBaseAssignment pending(Long baseId, Long farmerId) {
        return new PriorityBaseAssignment(null, baseId, farmerId, null, null,
                AssignmentStatus.PENDIENTE.name(), null, null, null);
    }
}
