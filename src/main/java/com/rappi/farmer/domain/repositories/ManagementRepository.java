package com.rappi.farmer.domain.repositories;

import com.rappi.farmer.domain.entities.Management;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ManagementRepository {
    Management save(Management management);
    Management update(Long id, String managementType, String resultType, String comments);
    Optional<Management> findLatestTodayByStoreId(Long storeId);
    Optional<Management> findLatestByStoreId(Long storeId);
    List<Management> findAllToday();
    List<Management> findTodayByUser(Long userId);
    List<Management> findByDateAndUser(Long userId, LocalDate date);
    List<Management> findRecentByStoreIds(List<Long> storeIds, java.time.LocalDateTime since);
    List<Management> findAllByStoreId(Long storeId);
    void deleteByStoreId(Long storeId);
    void deleteById(Long id);
    Optional<Management> findById(Long id);
}
