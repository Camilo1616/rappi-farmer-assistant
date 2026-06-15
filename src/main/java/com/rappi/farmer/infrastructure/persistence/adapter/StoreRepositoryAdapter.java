package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import com.rappi.farmer.infrastructure.persistence.entity.UserEntity;
import com.rappi.farmer.infrastructure.persistence.repository.StoreJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.UserJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class StoreRepositoryAdapter implements StoreRepository {

    private final StoreJpaRepository jpaRepository;
    private final UserJpaRepository userJpaRepository;

    @Override
    public Store save(Store store) {
        StoreEntity entity = toEntity(store);
        return toDomain(jpaRepository.save(entity));
    }

    @Override
    public Optional<Store> findByStoreCode(String storeCode) {
        return jpaRepository.findFirstByStoreCode(storeCode).map(this::toDomain);
    }

    @Override
    public Optional<Store> findByBrandId(String brandId) {
        return jpaRepository.findFirstByBrandId(brandId).map(this::toDomain);
    }

    @Override
    public List<Store> findAllByBrandId(String brandId) {
        return jpaRepository.findAllByBrandId(brandId).stream().map(this::toDomain).toList();
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
    public List<Store> findActiveByUser(Long userId) {
        return jpaRepository.findByUser_IdAndActiveTrue(userId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> searchByCodeOrName(String query) {
        return jpaRepository
                .searchByAnyField(query)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> searchByCodeOrNameAndUser(String query, Long userId) {
        return jpaRepository
                .searchByAnyFieldAndUser(query, userId)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findByUserId(Long userId) {
        return jpaRepository.findByUser_Id(userId).stream().map(this::toDomain).toList();
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public long countActiveByUserId(Long userId) {
        return jpaRepository.countByUser_IdAndActiveTrue(userId);
    }

    @Override
    public List<Store> findByUserIdAndIdIn(Long userId, List<Long> ids) {
        return jpaRepository.findByUser_IdAndIdIn(userId, ids).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findByIds(List<Long> ids) {
        return jpaRepository.findAllById(ids).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findChurnByFarmer(Long farmerId) {
        return jpaRepository.findChurnByFarmer(farmerId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findActiveF7dByFarmer(Long farmerId) {
        return jpaRepository.findActiveF7dByFarmer(farmerId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findRetencionByFarmer(Long farmerId) {
        return jpaRepository.findRetencionByFarmer(farmerId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findAva8a14ByFarmer(Long farmerId) {
        return jpaRepository.findAva8a14ByFarmer(farmerId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findChurnByFarmerIds(List<Long> farmerIds) {
        return jpaRepository.findChurnByFarmers(farmerIds).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findActiveF7dByFarmerIds(List<Long> farmerIds) {
        return jpaRepository.findActiveF7dByFarmers(farmerIds).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findRetencionByFarmerIds(List<Long> farmerIds) {
        return jpaRepository.findRetencionByFarmers(farmerIds).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findAva8a14ByFarmerIds(List<Long> farmerIds) {
        return jpaRepository.findAva8a14ByFarmers(farmerIds).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findAllActiveByFarmerIds(List<Long> farmerIds) {
        return jpaRepository.findAllActiveByFarmers(farmerIds).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findActiveSelfWithoutHandoff() {
        return jpaRepository.findActiveSelfWithoutHandoff().stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findActiveByFarmerIdsAndDays(List<Long> farmerIds, int minDays, int maxDays) {
        return jpaRepository.findActiveByFarmerIdsAndDays(farmerIds, minDays, maxDays).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findActiveNoLoginByFarmerIds(List<Long> farmerIds, int days) {
        return jpaRepository.findActiveNoLoginByFarmerIds(farmerIds, days).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Store> findChurnM1ByFarmerIds(List<Long> farmerIds) {
        return jpaRepository.findChurnM1ByFarmerIds(farmerIds).stream().map(this::toDomain).toList();
    }

    private StoreEntity toEntity(Store store) {
        StoreEntity entity = new StoreEntity();
        entity.setId(store.getId());
        entity.setStoreCode(store.getStoreCode());
        entity.setBrandId(store.getBrandId());
        entity.setStoreName(store.getStoreName());
        entity.setPhoneNumber(store.getPhoneNumber());
        entity.setChannel(store.getChannel());
        entity.setOnboardingDate(store.getOnboardingDate());
        entity.setActive(store.getActive() != null ? store.getActive() : true);
        entity.setConnectionPercentage(store.getConnectionPercentage());
        entity.setCurrentStatus(store.getCurrentStatus());
        entity.setHadHandoff(store.getHadHandoff());
        entity.setHandoffActivatedAt(store.getHandoffActivatedAt());
        entity.setAging(store.getAging());
        entity.setAgingStage(store.getAgingStage());
        entity.setLastLoginDate(store.getLastLoginDate());
        entity.setGestionar(store.getGestionar());
        entity.setUploadDate(store.getUploadDate());
        entity.setCredentialsDate(store.getCredentialsDate());
        entity.setUpdatedAt(LocalDateTime.now());
        if (store.getId() == null) entity.setCreatedAt(LocalDateTime.now());
        if (store.getFarmerId() != null) {
            userJpaRepository.findById(store.getFarmerId()).ifPresent(entity::setUser);
        }
        return entity;
    }

    private Store toDomain(StoreEntity e) {
        Long farmerId = e.getUser() != null ? e.getUser().getId() : null;
        String farmerEmail = e.getUser() != null ? e.getUser().getEmail() : null;
        Store s = new Store(
                e.getId(), e.getStoreCode(), e.getBrandId(), e.getStoreName(),
                e.getPhoneNumber(), e.getChannel(), e.getOnboardingDate(),
                e.getActive(), e.getConnectionPercentage(), e.getCurrentStatus(),
                e.getHadHandoff(), e.getHandoffActivatedAt(), farmerId, e.getAging(),
                e.getAgingStage(), e.getLastLoginDate(),
                e.getGestionar(), e.getUploadDate(), farmerEmail, e.getCredentialsDate()
        );
        return s;
    }
}
