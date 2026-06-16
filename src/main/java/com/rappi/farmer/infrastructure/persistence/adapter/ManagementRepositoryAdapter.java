package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.infrastructure.persistence.entity.ManagementEntity;
import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import com.rappi.farmer.infrastructure.persistence.entity.UserEntity;
import com.rappi.farmer.infrastructure.persistence.repository.ManagementJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.StoreJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.UserJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Transactional
public class ManagementRepositoryAdapter implements ManagementRepository {

    private final ManagementJpaRepository managementJpaRepository;
    private final StoreJpaRepository storeJpaRepository;
    private final UserJpaRepository userJpaRepository;

    @Override
    public Management save(Management management) {
        StoreEntity store = storeJpaRepository.findById(management.getStoreId())
                .orElseThrow(() -> new BusinessException("Tienda no encontrada: " + management.getStoreId()));

        UserEntity user = null;
        if (management.getUserId() != null) {
            user = userJpaRepository.findById(management.getUserId()).orElse(null);
        }

        ManagementEntity entity = new ManagementEntity();
        entity.setStore(store);
        entity.setUser(user);
        entity.setManagementType(management.getManagementType());
        entity.setResultType(management.getResultType());
        entity.setComments(management.getComments());
        entity.setManagementDate(management.getManagementDate());
        entity.setBrandSync(management.isBrandSync());

        return toDomain(managementJpaRepository.save(entity));
    }

    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

    @Override
    public Optional<Management> findLatestTodayByStoreId(Long storeId) {
        LocalDateTime start = LocalDate.now(BOGOTA).atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        return managementJpaRepository.findByStoreIdAndToday(storeId, start, end)
                .stream()
                .findFirst()
                .map(this::toDomain);
    }

    @Override
    public Management update(Long id, String managementType, String resultType, String comments) {
        ManagementEntity entity = managementJpaRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Gestión no encontrada: " + id));
        entity.setManagementType(managementType);
        entity.setResultType(resultType);
        entity.setComments(comments);
        entity.setManagementDate(java.time.LocalDateTime.now());
        return toDomain(managementJpaRepository.save(entity));
    }

    @Override
    public Optional<Management> findLatestByStoreId(Long storeId) {
        return managementJpaRepository
                .findLatestByStoreId(storeId, PageRequest.of(0, 1))
                .stream().findFirst()
                .map(this::toDomain);
    }

    @Override
    public List<Management> findAllToday() {
        LocalDateTime start = LocalDate.now(BOGOTA).atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        return managementJpaRepository.findAllToday(start, end).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Management> findTodayByUser(Long userId) {
        LocalDateTime start = LocalDate.now(BOGOTA).atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        return managementJpaRepository.findTodayByUserId(userId, start, end)
                .stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Override
    public List<Management> findByDateAndUser(Long userId, java.time.LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        return managementJpaRepository.findByUserIdAndDateRange(userId, start, end)
                .stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Override
    public List<Management> findRecentByStoreIds(List<Long> storeIds, java.time.LocalDateTime since) {
        if (storeIds.isEmpty()) return List.of();
        return managementJpaRepository.findRecentByStoreIds(storeIds, since)
                .stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Override
    public void deleteByStoreId(Long storeId) {
        managementJpaRepository.deleteByStoreId(storeId);
    }

    @Override
    public void deleteById(Long id) {
        managementJpaRepository.deleteById(id);
    }

    @Override
    public Optional<Management> findById(Long id) {
        return managementJpaRepository.findById(id).map(this::toDomain);
    }

    private Management toDomain(ManagementEntity e) {
        return new Management(
                e.getId(),
                e.getStore().getId(),
                e.getStore().getStoreName(),
                e.getStore().getStoreCode(),
                e.getUser() != null ? e.getUser().getId() : null,
                e.getManagementType(),
                e.getResultType(),
                e.getComments(),
                e.getManagementDate(),
                e.getUser() != null ? e.getUser().getFullName() : null,
                e.getUser() != null ? e.getUser().getFarmerCode() : null,
                e.isBrandSync()
        );
    }
}
