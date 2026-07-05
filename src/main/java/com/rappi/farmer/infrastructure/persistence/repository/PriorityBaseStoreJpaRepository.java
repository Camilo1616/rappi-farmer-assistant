package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.PriorityBaseStoreEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PriorityBaseStoreJpaRepository extends JpaRepository<PriorityBaseStoreEntity, Long> {

    @Query("SELECT s FROM PriorityBaseStoreEntity s JOIN FETCH s.store JOIN FETCH s.farmer " +
           "WHERE s.base.id = :baseId AND s.farmer.id = :farmerId ORDER BY s.store.storeName")
    List<PriorityBaseStoreEntity> findByBaseAndFarmer(@Param("baseId") Long baseId,
                                                       @Param("farmerId") Long farmerId);

    @Query("SELECT s FROM PriorityBaseStoreEntity s JOIN FETCH s.store JOIN FETCH s.farmer " +
           "WHERE s.base.id = :baseId ORDER BY s.farmer.fullName, s.store.storeName")
    List<PriorityBaseStoreEntity> findByBase(@Param("baseId") Long baseId);

    @Query("SELECT COUNT(s) FROM PriorityBaseStoreEntity s WHERE s.base.id = :baseId AND s.farmer.id = :farmerId")
    long countByBaseAndFarmer(@Param("baseId") Long baseId, @Param("farmerId") Long farmerId);

    @Query("SELECT COUNT(s) FROM PriorityBaseStoreEntity s WHERE s.base.id = :baseId AND s.farmer.id = :farmerId AND s.status = 'GESTIONADA'")
    long countManagedByBaseAndFarmer(@Param("baseId") Long baseId, @Param("farmerId") Long farmerId);

    void deleteByBaseId(Long baseId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("DELETE FROM PriorityBaseStoreEntity s WHERE s.store.id = :storeId")
    void deleteByStoreId(@Param("storeId") Long storeId);
}
