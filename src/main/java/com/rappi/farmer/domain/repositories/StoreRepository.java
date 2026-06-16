package com.rappi.farmer.domain.repositories;

import com.rappi.farmer.domain.entities.Store;

import java.util.List;
import java.util.Optional;

public interface StoreRepository {
    Store save(Store store);
    Optional<Store> findByStoreCode(String storeCode);
    Optional<Store> findByBrandId(String brandId);
    List<Store> findAllByBrandId(String brandId);
    Optional<Store> findById(Long id);
    List<Store> findAll();
    List<Store> findActive();
    List<Store> findActiveByUser(Long userId);
    List<Store> findByUserId(Long userId);
    void deleteById(Long id);
    long countActiveByUserId(Long userId);
    List<Store> searchByCodeOrName(String query);
    List<Store> searchByCodeOrNameAndUser(String query, Long userId);
    List<Store> findByUserIdAndIdIn(Long userId, List<Long> ids);
    List<Store> findByIds(List<Long> ids);
    // Queries por tipo de base — para un farmer
    List<Store> findChurnByFarmer(Long farmerId);
    List<Store> findActiveF7dByFarmer(Long farmerId);
    List<Store> findRetencionByFarmer(Long farmerId);
    List<Store> findAva8a14ByFarmer(Long farmerId);
    // Queries por tipo de base — para lista de farmers
    List<Store> findChurnByFarmerIds(List<Long> farmerIds);
    List<Store> findActiveF7dByFarmerIds(List<Long> farmerIds);
    List<Store> findActiveByFarmerIdsAndDays(List<Long> farmerIds, int minDays, int maxDays);
    @Deprecated
    List<Store> findActiveNoLoginByFarmerIds(List<Long> farmerIds, int days);
    List<Store> findActive7DaysWithSuccessfulManagement(List<Long> farmerIds);
    List<Store> findChurnM1ByFarmerIds(List<Long> farmerIds);
    List<Store> findRetencionByFarmerIds(List<Long> farmerIds);
    List<Store> findAva8a14ByFarmerIds(List<Long> farmerIds);
    List<Store> findAllActiveByFarmerIds(List<Long> farmerIds);
    List<Store> findActiveSelfWithoutHandoff();
}
