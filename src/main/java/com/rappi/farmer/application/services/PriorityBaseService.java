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

        PriorityBase base = PriorityBase.create(liderId, request.getBaseType(), request.getMessage());
        PriorityBase saved = repository.saveBase(base);

        int totalTiendas = 0;
        for (Long farmerId : request.getFarmerIds()) {
            repository.saveAssignment(PriorityBaseAssignment.pending(saved.getId(), farmerId));

            // Jalar tiendas del farmer según el tipo de base
            List<Store> tiendas = queryStoresByType(request.getBaseType(), farmerId, request.getActiveDays(), request.getChurnFilter());
            for (Store store : tiendas) {
                repository.saveBaseStore(PriorityBaseStore.pending(saved.getId(), farmerId, store.getId()));
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
            long gestionadas = stores.stream().filter(PriorityBaseStore::isGestionada).count();

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
            long gestionadas = stores.stream().filter(PriorityBaseStore::isGestionada).count();
            return toViewDto(base, assignments.size(), (int) completados, (int) enProceso,
                    (int) pendientes, stores.size(), (int) gestionadas);
        });
    }

    /** Notificaciones para el LÍDER: assignments que pasaron a LEIDA o COMPLETADA recientemente. */
    public List<AssignmentViewDto> getRecentActivityForLider(Long liderId) {
        LocalDateTime since = LocalDateTime.now(ZoneId.of("America/Bogota")).minusHours(24);
        return repository.findBasesByLider(liderId).stream()
                .flatMap(base -> repository.findAssignmentsByBase(base.getId()).stream()
                        .filter(a -> a.recentlyActive(since)))
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
        a.markEnProceso();
        repository.saveAssignment(a);
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
        if (!base.belongsTo(liderId)) {
            throw new BusinessException("No tienes permiso para eliminar esta base");
        }
        repository.deleteBase(baseId);
        log.info("Base {} eliminada por líder {}", baseId, liderId);
    }

    @Transactional
    public void updateStoreStatus(Long baseStoreId, String status, String managementType, String comments) {
        PriorityBaseStore bs = repository.findBaseStoreById(baseStoreId)
                .orElseThrow(() -> new BusinessException("Tienda de base no encontrada: " + baseStoreId));
        bs.updateManagement(status, managementType, comments);
        repository.saveBaseStore(bs);
    }

    // ── privados ──

    private List<Store> queryStoresByType(String baseType, Long farmerId, Integer activeDays, String churnFilter) {
        if ("ACTIVE".equals(baseType)) {
            return storeRepository.findActive7DaysWithSuccessfulManagement(List.of(farmerId));
        }
        if ("ACTIVE_28".equals(baseType)) {
            return storeRepository.findActive8to28DaysWithSuccessfulManagement(List.of(farmerId));
        }
        if ("GESTIONAR_IS".equals(baseType)) {
            return storeRepository.findGestionarIsByFarmerIds(List.of(farmerId));
        }
        if ("CHURN".equals(baseType) && "M1".equals(churnFilter)) {
            return storeRepository.findChurnM1ByFarmerIds(List.of(farmerId));
        }
        return dashboardService.getStoresForBase(farmerId, baseType);
    }

    private void updateStatus(Long assignmentId, AssignmentStatus newStatus, String comments) {
        PriorityBaseAssignment a = repository.findAssignmentById(assignmentId)
                .orElseThrow(() -> new BusinessException("Asignación no encontrada: " + assignmentId));
        a.transitionTo(newStatus, comments);
        repository.saveAssignment(a);
    }

    private long count(List<PriorityBaseAssignment> list, AssignmentStatus status) {
        return list.stream().filter(a -> a.hasStatus(status)).count();
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
