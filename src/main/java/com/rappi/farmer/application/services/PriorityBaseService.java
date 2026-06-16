package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.AssignmentViewDto;
import com.rappi.farmer.application.dtos.CreatePriorityBaseRequest;
import com.rappi.farmer.application.dtos.PriorityBaseViewDto;
import com.rappi.farmer.application.dtos.PriorityBaseStoreViewDto;
import com.rappi.farmer.domain.entities.PriorityBase;
import com.rappi.farmer.domain.entities.PriorityBaseAssignment;
import com.rappi.farmer.domain.entities.PriorityBaseStore;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.enums.AssignmentStatus;
import com.rappi.farmer.domain.enums.BaseType;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.repositories.PriorityBaseRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PriorityBaseService {

    private final PriorityBaseRepository repository;
    private final StoreRepository storeRepository;
    private final DashboardService dashboardService;

    @Transactional
    public PriorityBaseViewDto createBase(Long liderId, CreatePriorityBaseRequest request) {
        if (request.getMessage() == null || request.getMessage().isBlank()) {
            throw new BusinessException("El mensaje de la base no puede estar vacío");
        }
        if (request.getFarmerIds() == null || request.getFarmerIds().isEmpty()) {
            throw new BusinessException("Debes etiquetar al menos un farmer");
        }

        PriorityBase base = new PriorityBase(null, liderId, null,
                request.getBaseType(), request.getMessage(), LocalDateTime.now(ZoneId.of("America/Bogota")));
        PriorityBase saved = repository.saveBase(base);

        int totalTiendas = 0;
        for (Long farmerId : request.getFarmerIds()) {
            // Crear asignación de farmer
            PriorityBaseAssignment assignment = new PriorityBaseAssignment(
                    null, saved.getId(), farmerId, null, null,
                    AssignmentStatus.PENDIENTE.name(), null, null, null);
            repository.saveAssignment(assignment);

            // Jalar tiendas del farmer según el tipo de base
            List<Store> tiendas = queryStoresByType(request.getBaseType(), farmerId, request.getActiveDays(), request.getChurnFilter());
            for (Store store : tiendas) {
                PriorityBaseStore bs = new PriorityBaseStore(
                        null, saved.getId(), farmerId, null,
                        store.getId(), null, null, null, null,
                        "PENDIENTE", null, null, null);
                repository.saveBaseStore(bs);
            }
            totalTiendas += tiendas.size();
            log.info("Base {} — farmer {} — {} tiendas jaladas ({})",
                    saved.getId(), farmerId, tiendas.size(), request.getBaseType());
        }

        log.info("Base creada — tipo:{} lider:{} farmers:{} tiendas totales:{}",
                request.getBaseType(), liderId, request.getFarmerIds().size(), totalTiendas);

        return toViewDto(saved, request.getFarmerIds().size(), 0, 0, request.getFarmerIds().size(), totalTiendas, 0);
    }

    public List<PriorityBaseViewDto> getBasesByLider(Long liderId) {
        return repository.findBasesByLider(liderId).stream().map(base -> {
            List<PriorityBaseAssignment> assignments = repository.findAssignmentsByBase(base.getId());
            long completados = count(assignments, AssignmentStatus.COMPLETADA);
            long enProceso   = count(assignments, AssignmentStatus.EN_PROCESO)
                             + count(assignments, AssignmentStatus.LEIDA);
            long pendientes  = count(assignments, AssignmentStatus.PENDIENTE);

            List<PriorityBaseStore> stores = repository.findStoresByBase(base.getId());
            long tiendas    = stores.size();
            long gestionadas = stores.stream().filter(s -> "GESTIONADA".equals(s.getStatus())).count();

            return toViewDto(base, assignments.size(), (int) completados, (int) enProceso,
                    (int) pendientes, (int) tiendas, (int) gestionadas);
        }).toList();
    }

    public List<AssignmentViewDto> getAssignmentsByBase(Long baseId) {
        List<PriorityBaseAssignment> assignments = repository.findAssignmentsByBase(baseId);
        return assignments.stream().map(a -> {
            long total     = repository.countStoresByBaseAndFarmer(baseId, a.getFarmerId());
            long gestionadas = repository.countManagedByBaseAndFarmer(baseId, a.getFarmerId());
            return toAssignmentDto(a, total, gestionadas);
        }).toList();
    }

    public List<PriorityBaseStoreViewDto> getStoresByBaseAndFarmer(Long baseId, Long farmerId) {
        return repository.findStoresByBaseAndFarmer(baseId, farmerId).stream()
                .map(this::toStoreDto).toList();
    }

    public List<PriorityBaseStoreViewDto> getStoresByBase(Long baseId) {
        return repository.findStoresByBase(baseId).stream()
                .map(this::toStoreDto).toList();
    }

    public Optional<PriorityBaseViewDto> findBaseById(Long baseId) {
        return repository.findBaseById(baseId).map(base -> {
            List<PriorityBaseAssignment> assignments = repository.findAssignmentsByBase(base.getId());
            long completados = count(assignments, AssignmentStatus.COMPLETADA);
            long enProceso   = count(assignments, AssignmentStatus.EN_PROCESO)
                             + count(assignments, AssignmentStatus.LEIDA);
            long pendientes  = count(assignments, AssignmentStatus.PENDIENTE);
            List<PriorityBaseStore> stores = repository.findStoresByBase(base.getId());
            long gestionadas = stores.stream().filter(s -> "GESTIONADA".equals(s.getStatus())).count();
            return toViewDto(base, assignments.size(), (int) completados, (int) enProceso,
                    (int) pendientes, stores.size(), (int) gestionadas);
        });
    }

    /** Notificaciones para el LÍDER: assignments que pasaron a LEIDA o COMPLETADA recientemente. */
    public List<AssignmentViewDto> getRecentActivityForLider(Long liderId) {
        return repository.findBasesByLider(liderId).stream()
                .flatMap(base -> repository.findAssignmentsByBase(base.getId()).stream()
                        .filter(a -> AssignmentStatus.LEIDA.name().equals(a.getStatus())
                                || AssignmentStatus.COMPLETADA.name().equals(a.getStatus()))
                        .filter(a -> a.getReadAt() != null
                                && a.getReadAt().isAfter(LocalDateTime.now(ZoneId.of("America/Bogota")).minusHours(24))))
                .map(a -> {
                    long total       = repository.countStoresByBaseAndFarmer(a.getBaseId(), a.getFarmerId());
                    long gestionadas = repository.countManagedByBaseAndFarmer(a.getBaseId(), a.getFarmerId());
                    return toAssignmentDto(a, total, gestionadas);
                }).toList();
    }

    /** Todas las bases del farmer ordenadas por fecha (para el panel "Mis Bases"). */
    public List<AssignmentViewDto> getAllForFarmer(Long farmerId) {
        return repository.findAllByFarmer(farmerId).stream()
                .map(a -> {
                    long total       = repository.countStoresByBaseAndFarmer(a.getBaseId(), farmerId);
                    long gestionadas = repository.countManagedByBaseAndFarmer(a.getBaseId(), farmerId);
                    return toAssignmentDto(a, total, gestionadas);
                }).toList();
    }

    /** Notificaciones pendientes para un farmer al hacer login. */
    public List<AssignmentViewDto> getPendingForFarmer(Long farmerId) {
        return repository.findPendingByFarmer(farmerId).stream()
                .map(a -> {
                    long total       = repository.countStoresByBaseAndFarmer(a.getBaseId(), farmerId);
                    long gestionadas = repository.countManagedByBaseAndFarmer(a.getBaseId(), farmerId);
                    return toAssignmentDto(a, total, gestionadas);
                }).toList();
    }

    @Transactional
    public void markEnProceso(Long assignmentId) {
        PriorityBaseAssignment a = repository.findAssignmentById(assignmentId)
                .orElseThrow(() -> new BusinessException("Asignación no encontrada: " + assignmentId));
        // Solo avanzar hacia adelante, nunca hacia atrás
        if (AssignmentStatus.PENDIENTE.name().equals(a.getStatus())
                || AssignmentStatus.LEIDA.name().equals(a.getStatus())) {
            a.setStatus(AssignmentStatus.EN_PROCESO.name());
            if (a.getReadAt() == null) a.setReadAt(LocalDateTime.now(ZoneId.of("America/Bogota")));
            repository.saveAssignment(a);
        }
    }

    @Transactional
    public void markRead(Long assignmentId) {
        updateStatus(assignmentId, AssignmentStatus.LEIDA, null);
    }

    @Transactional
    public void updateAssignmentStatus(Long assignmentId, String status, String comments) {
        updateStatus(assignmentId, AssignmentStatus.valueOf(status), comments);
    }

    @Transactional
    public void deleteBase(Long baseId, Long liderId) {
        PriorityBase base = repository.findBaseById(baseId)
                .orElseThrow(() -> new BusinessException("Base no encontrada: " + baseId));
        if (!base.getLiderId().equals(liderId)) {
            throw new BusinessException("No tienes permiso para eliminar esta base");
        }
        repository.deleteBase(baseId);
        log.info("Base {} eliminada por líder {}", baseId, liderId);
    }

    @Transactional
    public void updateStoreStatus(Long baseStoreId, String status, String managementType, String comments) {
        PriorityBaseStore bs = repository.findBaseStoreById(baseStoreId)
                .orElseThrow(() -> new BusinessException("Tienda de base no encontrada: " + baseStoreId));
        bs.setStatus(status);
        bs.setManagementType(managementType);
        bs.setComments(comments);
        bs.setManagedAt("GESTIONADA".equals(status) || "NO_CONTACTO".equals(status)
                ? LocalDateTime.now(ZoneId.of("America/Bogota")) : bs.getManagedAt());
        repository.saveBaseStore(bs);
    }

    // ── privados ──

    private List<Store> queryStoresByType(String baseType, Long farmerId, Integer activeDays, String churnFilter) {
        if ("ACTIVE".equals(baseType)) {
            return storeRepository.findActive7DaysWithSuccessfulManagement(List.of(farmerId));
        }
        if ("CHURN".equals(baseType) && "M1".equals(churnFilter)) {
            return storeRepository.findChurnM1ByFarmerIds(List.of(farmerId));
        }
        return dashboardService.getStoresForBase(farmerId, baseType);
    }

    private void updateStatus(Long assignmentId, AssignmentStatus newStatus, String comments) {
        PriorityBaseAssignment a = repository.findAssignmentById(assignmentId)
                .orElseThrow(() -> new BusinessException("Asignación no encontrada: " + assignmentId));
        a.setStatus(newStatus.name());
        if (comments != null) a.setComments(comments);
        if (newStatus == AssignmentStatus.LEIDA && a.getReadAt() == null) a.setReadAt(LocalDateTime.now(ZoneId.of("America/Bogota")));
        if (newStatus == AssignmentStatus.COMPLETADA) a.setCompletedAt(LocalDateTime.now(ZoneId.of("America/Bogota")));
        repository.saveAssignment(a);
    }

    private long count(List<PriorityBaseAssignment> list, AssignmentStatus status) {
        return list.stream().filter(a -> status.name().equals(a.getStatus())).count();
    }

    private PriorityBaseViewDto toViewDto(PriorityBase base, int farmers, int completados,
                                           int enProceso, int pendientes, int tiendas, int gestionadas) {
        String typeDisplay = safeDisplayName(base.getBaseType());
        return new PriorityBaseViewDto(base.getId(), base.getBaseType(), typeDisplay,
                base.getMessage(), base.getLiderName(), base.getCreatedAt(),
                farmers, completados, enProceso, pendientes, tiendas, gestionadas);
    }

    private AssignmentViewDto toAssignmentDto(PriorityBaseAssignment a, long total, long gestionadas) {
        String statusDisplay = safeStatusDisplay(a.getStatus());
        AssignmentViewDto dto = new AssignmentViewDto(a.getId(), a.getBaseId(), a.getFarmerId(),
                a.getFarmerName(), a.getFarmerCode(),
                a.getStatus(), statusDisplay, a.getComments(),
                a.getReadAt(), a.getCompletedAt(), total, gestionadas,
                null, null, null, null, null);
        repository.findBaseById(a.getBaseId()).ifPresent(base -> {
            dto.setBaseType(base.getBaseType());
            dto.setBaseTypeDisplay(safeDisplayName(base.getBaseType()));
            dto.setBaseMessage(base.getMessage());
            dto.setLiderName(base.getLiderName());
            dto.setBaseCreatedAt(base.getCreatedAt());
        });
        return dto;
    }

    private PriorityBaseStoreViewDto toStoreDto(PriorityBaseStore bs) {
        return new PriorityBaseStoreViewDto(bs.getId(), bs.getBaseId(), bs.getStoreId(),
                bs.getFarmerName(), bs.getStoreCode(), bs.getStoreName(),
                bs.getPhoneNumber(), bs.getCurrentStatus(), bs.getStatus(),
                bs.getManagementType(), bs.getComments(), bs.getManagedAt());
    }

    private String safeDisplayName(String type) {
        try { return BaseType.valueOf(type).displayName(); } catch (Exception e) { return type; }
    }

    private String safeStatusDisplay(String status) {
        try { return AssignmentStatus.valueOf(status).displayName(); } catch (Exception e) { return status; }
    }
}
