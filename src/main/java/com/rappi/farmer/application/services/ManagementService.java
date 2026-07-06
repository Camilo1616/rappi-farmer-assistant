package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ManagementViewDto;
import com.rappi.farmer.application.dtos.RegisterManagementRequest;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.application.SessionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ManagementService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

    // Un lock por brand (o por tienda si no tiene marca) evita que registros concurrentes
    // para la misma tienda/marca pasen ambos el check "ya existe gestión hoy" antes de escribir.
    private static final ConcurrentHashMap<String, Object> REGISTER_LOCKS = new ConcurrentHashMap<>();

    private final ManagementRepository managementRepository;
    private final StoreRepository storeRepository;
    private final SessionContext sessionContext;

    @Transactional
    public Management register(RegisterManagementRequest request) {
        String brandId = storeRepository.findById(request.getStoreId())
                .map(com.rappi.farmer.domain.entities.Store::getBrandId)
                .orElse(null);
        String lockKey = brandId != null ? "brand:" + brandId : "store:" + request.getStoreId();
        Object lock = REGISTER_LOCKS.computeIfAbsent(lockKey, k -> new Object());
        synchronized (lock) {
            return doRegister(request);
        }
    }

    private Management doRegister(RegisterManagementRequest request) {
        Long userId = sessionContext.getCurrentUserId();
        LocalDateTime now = LocalDateTime.now(BOGOTA);

        // Bloquear si ya existe gestión hoy para esta tienda o cualquier hermana de la misma brand
        if (managementRepository.findLatestTodayByStoreId(request.getStoreId()).isPresent()) {
            throw new com.rappi.farmer.domain.exceptions.BusinessException(
                    "Ya se registró una gestión hoy para esta tienda");
        }
        storeRepository.findById(request.getStoreId()).ifPresent(origin -> {
            if (origin.getBrandId() != null) {
                storeRepository.findAllByBrandId(origin.getBrandId()).forEach(sibling -> {
                    if (!sibling.getId().equals(request.getStoreId())
                            && managementRepository.findLatestTodayByStoreId(sibling.getId()).isPresent()) {
                        throw new com.rappi.farmer.domain.exceptions.BusinessException(
                                "Ya se registró una gestión hoy para otra tienda de esta marca (Brand ID: " + origin.getBrandId() + ")");
                    }
                });
            }
        });

        Management management = Management.register(request.getStoreId(), userId,
                request.getManagementType(), request.getResultType(), request.getComments(), now);
        Management saved = managementRepository.save(management);
        log.info("Gestión registrada — tienda:{} tipo:{} resultado:{}",
                request.getStoreId(), request.getManagementType(), request.getResultType());

        // Registrar la misma gestión en todas las tiendas de la misma Brand ID
        storeRepository.findById(request.getStoreId()).ifPresent(origin -> {
            if (origin.getBrandId() != null) {
                List<com.rappi.farmer.domain.entities.Store> siblings =
                        storeRepository.findAllByBrandId(origin.getBrandId());
                for (com.rappi.farmer.domain.entities.Store sibling : siblings) {
                    if (sibling.getId().equals(request.getStoreId())) continue;
                    managementRepository.save(saved.propagateTo(sibling.getId()));
                    log.info("Gestión en hermana brandId:{} tienda:{}", origin.getBrandId(), sibling.getId());
                }
            }
        });

        return saved;
    }

    @Transactional
    public Management update(Long managementId, String managementType, String resultType, String comments) {
        Management existing = managementRepository.findById(managementId)
                .orElseThrow(() -> new com.rappi.farmer.domain.exceptions.BusinessException("Gestión no encontrada"));
        assertModifiable(existing);
        Management updated = managementRepository.update(managementId, managementType, resultType, comments);
        log.info("Gestión actualizada — id:{} tipo:{} resultado:{}", managementId, managementType, resultType);
        return updated;
    }

    @Transactional
    public void deleteManagement(Long managementId) {
        Management m = managementRepository.findById(managementId)
                .orElseThrow(() -> new com.rappi.farmer.domain.exceptions.BusinessException("Gestión no encontrada"));
        assertModifiable(m);
        if (!m.isEditableToday(BOGOTA)) {
            throw new com.rappi.farmer.domain.exceptions.BusinessException("Solo se pueden eliminar gestiones del día actual");
        }
        managementRepository.deleteById(managementId);
        log.info("Gestión eliminada — id:{}", managementId);
    }

    private void assertModifiable(Management management) {
        if (!management.canBeModifiedBy(sessionContext.getCurrentUserId(), sessionContext.getCurrentUserRole())) {
            throw new com.rappi.farmer.domain.exceptions.BusinessException("No puedes modificar una gestión que no es tuya");
        }
    }

    public Optional<String> getTodayResultForStore(Long storeId) {
        return managementRepository.findLatestTodayByStoreId(storeId)
                .map(Management::getResultType);
    }

    @Transactional(readOnly = true)
    public List<ManagementViewDto> getTodayManagements() {
        Long userId = sessionContext.getCurrentUserId();
        boolean isLider = sessionContext.getCurrentUserRole() != null
                && com.rappi.farmer.domain.enums.UserRole.LIDER == sessionContext.getCurrentUserRole();

        List<Management> all = managementRepository.findAllToday();
        log.info("getTodayManagements — userId:{} isLider:{} totalHoy:{}", userId, isLider, all.size());

        // Líder ve todo. Farmer filtra por su userId
        List<Management> managements = (isLider || userId == null)
                ? all
                : all.stream()
                    .filter(m -> userId.equals(m.getUserId()))
                    .collect(java.util.stream.Collectors.toList());

        log.info("getTodayManagements — mostrando:{}", managements.size());

        // Batch: una sola query para todos los stores necesarios
        List<Long> storeIds = managements.stream()
                .map(Management::getStoreId).filter(id -> id != null).distinct().toList();
        java.util.Map<Long, Boolean> handoffMap = storeIds.isEmpty()
                ? java.util.Map.of()
                : storeRepository.findByIds(storeIds).stream()
                        .collect(Collectors.toMap(
                                com.rappi.farmer.domain.entities.Store::getId,
                                s -> s.getHadHandoff() != null && s.getHadHandoff()));

        return managements.stream()
                .map(m -> toViewDto(m, handoffMap))
                .collect(Collectors.toList());
    }

    private ManagementViewDto toViewDto(Management m, java.util.Map<Long, Boolean> handoffMap) {
        Boolean hadHandoff = m.getStoreId() != null ? handoffMap.get(m.getStoreId()) : null;
        return new ManagementViewDto(
                m.getId(),
                m.getUserId(),
                m.getStoreName(),
                m.getStoreCode(),
                m.getManagementType(),
                m.getResultType(),
                m.getComments(),
                m.getManagementDate() != null ? m.getManagementDate().format(TIME_FMT) : "",
                m.getFarmerName(),
                m.getFarmerCode(),
                hadHandoff,
                m.isBrandSync()
        );
    }
}
