package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import com.rappi.farmer.infrastructure.persistence.repository.StoreJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class StoreRepositoryAdapter implements StoreRepository {

    private final StoreJpaRepository jpaRepository;

    @Override
    public Store save(Store store) {
        StoreEntity entity = toEntity(store);
        return toDomain(jpaRepository.save(entity));
    }

    @Override
    public Optional<Store> findByStoreCode(String storeCode) {
        return jpaRepository.findByStoreCode(storeCode).map(this::toDomain);
    }

    @Override
    public Optional<Store> findById(Long id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public List<Store> findAll() {
        return jpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findActive() {
        return jpaRepository.findByActiveTrue().stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> searchByCodeOrName(String query) {
        return jpaRepository
                .findByStoreCodeContainingIgnoreCaseOrStoreNameContainingIgnoreCase(query, query)
                .stream().map(this::toDomain).toList();
    }

    private StoreEntity toEntity(Store store) {
        StoreEntity entity = new StoreEntity();
        entity.setId(store.getId());
        entity.setStoreCode(store.getStoreCode());
        entity.setStoreName(store.getStoreName());
        entity.setPhoneNumber(store.getPhoneNumber());
        entity.setChannel(store.getChannel());
        entity.setOnboardingDate(store.getOnboardingDate());
        entity.setActive(store.getActive() != null ? store.getActive() : true);
        entity.setConnectionPercentage(store.getConnectionPercentage());
        entity.setCurrentStatus(store.getCurrentStatus());
        entity.setHadHandoff(store.getHadHandoff());
        entity.setUpdatedAt(LocalDateTime.now());
        if (store.getId() == null) {
            entity.setCreatedAt(LocalDateTime.now());
        }
        return entity;
    }

    private Store toDomain(StoreEntity e) {
        return new Store(
                e.getId(), e.getStoreCode(), e.getStoreName(),
                e.getPhoneNumber(), e.getChannel(), e.getOnboardingDate(),
                e.getActive(), e.getConnectionPercentage(), e.getCurrentStatus(), e.getHadHandoff()
        );
    }
}
