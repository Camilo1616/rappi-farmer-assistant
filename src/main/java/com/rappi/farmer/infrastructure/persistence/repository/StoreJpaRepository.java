package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoreJpaRepository extends JpaRepository<StoreEntity, Long> {
    Optional<StoreEntity> findByStoreCode(String storeCode);
    List<StoreEntity> findByStoreCodeContainingIgnoreCaseOrStoreNameContainingIgnoreCase(String code, String name);
    List<StoreEntity> findByActiveTrue();
}
