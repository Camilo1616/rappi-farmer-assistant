package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.BaseAssignmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface BaseAssignmentJpaRepository extends JpaRepository<BaseAssignmentEntity, Long> {
    List<BaseAssignmentEntity> findByBaseId(Long baseId);
    List<BaseAssignmentEntity> findByFarmerIdOrderByAssignedAtDesc(Long farmerId);
    Optional<BaseAssignmentEntity> findByBaseIdAndFarmerId(Long baseId, Long farmerId);

    @Query("SELECT COUNT(a) FROM BaseAssignmentEntity a WHERE a.baseId = :baseId AND a.status = :status")
    long countByBaseIdAndStatus(@Param("baseId") Long baseId, @Param("status") String status);
}
