package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.entities.DailyMetric;
import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.infrastructure.persistence.entity.DailyMetricEntity;
import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import com.rappi.farmer.infrastructure.persistence.repository.DailyMetricJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.StoreJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class DailyMetricRepositoryAdapter implements DailyMetricRepository {

    private final DailyMetricJpaRepository jpaRepository;
    private final StoreJpaRepository storeJpaRepository;

    @Override
    public DailyMetric save(DailyMetric metric) {
        // getReferenceById crea un proxy sin cargar la entidad completa — solo necesitamos el FK
        StoreEntity store = storeJpaRepository.getReferenceById(metric.getStoreId());
        DailyMetricEntity entity = toEntity(metric, store);
        return toDomain(jpaRepository.save(entity));
    }

    @Override
    public List<DailyMetric> findByDate(LocalDate date) {
        return jpaRepository.findByMetricDate(date).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<DailyMetric> findLatestByStoreId(Long storeId) {
        return jpaRepository.findTop1ByStore_IdOrderByMetricDateDesc(storeId).map(this::toDomain);
    }

    @Override
    public Optional<DailyMetric> findByStoreIdAndDate(Long storeId, LocalDate date) {
        return jpaRepository.findByStore_IdAndMetricDate(storeId, date).map(this::toDomain);
    }

    private DailyMetricEntity toEntity(DailyMetric metric, StoreEntity store) {
        DailyMetricEntity entity = new DailyMetricEntity();
        entity.setId(metric.getId());
        entity.setStore(store);
        entity.setMetricDate(metric.getMetricDate());
        entity.setSales(metric.getSales());
        entity.setConnectionPercentage(metric.getConnectionPercentage());
        entity.setRappiAlliesConnected(metric.getRappiAlliesConnected());
        entity.setOrdersCount(metric.getOrdersCount());
        entity.setAvaL7d(metric.getAvaL7d());
        entity.setAvaStatus(metric.getAvaStatus());
        return entity;
    }

    private DailyMetric toDomain(DailyMetricEntity e) {
        return new DailyMetric(
                e.getId(),
                e.getStore().getId(),
                e.getMetricDate(),
                e.getSales(),
                e.getConnectionPercentage(),
                e.getRappiAlliesConnected(),
                e.getOrdersCount(),
                e.getAvaL7d(),
                e.getAvaStatus()
        );
    }
}
