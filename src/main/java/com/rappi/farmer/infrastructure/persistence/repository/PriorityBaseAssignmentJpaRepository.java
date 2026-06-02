package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.PriorityBaseAssignmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PriorityBaseAssignmentJpaRepository extends JpaRepository<PriorityBaseAssignmentEntity, Long> {

    @Query("SELECT a FROM PriorityBaseAssignmentEntity a JOIN FETCH a.farmer WHERE a.base.id = :baseId ORDER BY a.farmer.fullName")
    List<PriorityBaseAssignmentEntity> findByBaseId(@Param("baseId") Long baseId);

    @Query("SELECT a FROM PriorityBaseAssignmentEntity a JOIN FETCH a.base WHERE a.farmer.id = :farmerId AND a.status = 'PENDIENTE' ORDER BY a.base.createdAt DESC")
    List<PriorityBaseAssignmentEntity> findPendingByFarmerId(@Param("farmerId") Long farmerId);

    @Query("SELECT a FROM PriorityBaseAssignmentEntity a JOIN FETCH a.base WHERE a.farmer.id = :farmerId ORDER BY a.base.createdAt DESC")
    List<PriorityBaseAssignmentEntity> findAllByFarmerId(@Param("farmerId") Long farmerId);

    void deleteByBaseId(Long baseId);
}
