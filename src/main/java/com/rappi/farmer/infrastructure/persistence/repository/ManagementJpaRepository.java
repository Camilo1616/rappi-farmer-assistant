package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.ManagementEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ManagementJpaRepository extends JpaRepository<ManagementEntity, Long> {

    @Query("SELECT m FROM ManagementEntity m JOIN FETCH m.store " +
           "WHERE m.store.id = :storeId AND m.managementDate >= :start AND m.managementDate < :end " +
           "ORDER BY m.managementDate DESC")
    List<ManagementEntity> findByStoreIdAndToday(
            @Param("storeId") Long storeId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT m FROM ManagementEntity m JOIN FETCH m.store " +
           "WHERE m.managementDate >= :start AND m.managementDate < :end " +
           "ORDER BY m.managementDate DESC")
    List<ManagementEntity> findAllToday(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT m FROM ManagementEntity m WHERE m.store.id = :storeId " +
           "ORDER BY m.managementDate DESC")
    List<ManagementEntity> findLatestByStoreId(
            @Param("storeId") Long storeId,
            org.springframework.data.domain.Pageable pageable);
}
