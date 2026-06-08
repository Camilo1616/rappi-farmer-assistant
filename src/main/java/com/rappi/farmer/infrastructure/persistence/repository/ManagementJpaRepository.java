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

    @Query("SELECT m FROM ManagementEntity m JOIN FETCH m.store LEFT JOIN FETCH m.user " +
           "WHERE m.managementDate >= :start AND m.managementDate < :end " +
           "ORDER BY m.managementDate DESC")
    List<ManagementEntity> findAllToday(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT m FROM ManagementEntity m JOIN FETCH m.store WHERE m.store.id = :storeId " +
           "ORDER BY m.managementDate DESC")
    List<ManagementEntity> findLatestByStoreId(
            @Param("storeId") Long storeId,
            org.springframework.data.domain.Pageable pageable);

    @Query("SELECT COUNT(m) FROM ManagementEntity m " +
           "WHERE m.user.id = :userId AND m.managementDate >= :start AND m.managementDate < :end " +
           "AND m.brandSync = false")
    long countTodayByUserId(@Param("userId") Long userId,
                            @Param("start") LocalDateTime start,
                            @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(m) FROM ManagementEntity m " +
           "WHERE m.user.id = :userId AND m.resultType = :result " +
           "AND m.managementDate >= :start AND m.managementDate < :end " +
           "AND m.brandSync = false")
    long countTodayByUserIdAndResult(@Param("userId") Long userId,
                                     @Param("result") String result,
                                     @Param("start") LocalDateTime start,
                                     @Param("end") LocalDateTime end);

    @Query("SELECT m FROM ManagementEntity m JOIN FETCH m.store LEFT JOIN FETCH m.user " +
           "WHERE m.user.id = :userId AND m.managementDate >= :start AND m.managementDate < :end " +
           "ORDER BY m.managementDate DESC")
    List<ManagementEntity> findTodayByUserId(@Param("userId") Long userId,
                                              @Param("start") LocalDateTime start,
                                              @Param("end") LocalDateTime end);

    @Query("SELECT m FROM ManagementEntity m JOIN FETCH m.store LEFT JOIN FETCH m.user " +
           "WHERE m.user.id = :userId AND m.managementDate >= :start " +
           "ORDER BY m.managementDate DESC")
    List<ManagementEntity> findByUserIdSince(@Param("userId") Long userId,
                                              @Param("start") LocalDateTime start);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("DELETE FROM ManagementEntity m WHERE m.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("DELETE FROM ManagementEntity m WHERE m.store.id = :storeId")
    void deleteByStoreId(@Param("storeId") Long storeId);
}
