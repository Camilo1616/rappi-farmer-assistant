package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.PriorityEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PriorityJpaRepository extends JpaRepository<PriorityEntity, Long> {

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM PriorityEntity p WHERE p.store.id = :storeId")
    void deleteByStoreId(@Param("storeId") Long storeId);
}
