package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.PriorityBaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PriorityBaseJpaRepository extends JpaRepository<PriorityBaseEntity, Long> {

    @Query("SELECT b FROM PriorityBaseEntity b JOIN FETCH b.lider WHERE b.lider.id = :liderId ORDER BY b.createdAt DESC")
    List<PriorityBaseEntity> findByLiderId(@Param("liderId") Long liderId);
}
