package com.rappi.farmer.domain.repositories;

import com.rappi.farmer.domain.entities.DailyMetric;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyMetricRepository {
    DailyMetric save(DailyMetric metric);
    List<DailyMetric> findByDate(LocalDate date);
    Optional<DailyMetric> findLatestByStoreId(Long storeId);
    Optional<DailyMetric> findByStoreIdAndDate(Long storeId, LocalDate date);
}
