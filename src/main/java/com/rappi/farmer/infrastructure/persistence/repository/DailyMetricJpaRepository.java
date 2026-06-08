package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.DailyMetricEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyMetricJpaRepository extends JpaRepository<DailyMetricEntity, Long> {
    Optional<DailyMetricEntity> findByStore_IdAndMetricDate(Long storeId, LocalDate metricDate);
    List<DailyMetricEntity> findByMetricDate(LocalDate metricDate);
    Optional<DailyMetricEntity> findTop1ByStore_IdOrderByMetricDateDesc(Long storeId);
    Optional<DailyMetricEntity> findTop1ByOrderByMetricDateDesc();
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM DailyMetricEntity d WHERE d.store.id = :storeId")
    void deleteByStore_Id(@org.springframework.data.repository.query.Param("storeId") Long storeId);
}
