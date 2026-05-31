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
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;

@Component
@RequiredArgsConstructor
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

        return toDomain(managementJpaRepository.save(entity));
    }

    @Override
    public Optional<Management> findLatestTodayByStoreId(Long storeId) {
        LocalDateTime start = LocalDate.now().atStartOfDay();
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
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        return managementJpaRepository.findAllToday(start, end).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
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
                e.getManagementDate()
        );
    }
}
