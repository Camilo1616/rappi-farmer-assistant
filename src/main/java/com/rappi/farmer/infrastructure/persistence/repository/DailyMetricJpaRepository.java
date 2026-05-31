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
}
