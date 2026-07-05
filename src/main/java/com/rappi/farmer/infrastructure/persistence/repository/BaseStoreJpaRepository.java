package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.BaseStoreEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BaseStoreJpaRepository extends JpaRepository<BaseStoreEntity, Long> {
    List<BaseStoreEntity> findByBaseId(Long baseId);
    long countByBaseId(Long baseId);
    void deleteByBaseId(Long baseId);
}
