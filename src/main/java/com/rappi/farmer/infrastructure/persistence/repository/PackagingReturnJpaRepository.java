package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.PackagingReturnEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PackagingReturnJpaRepository extends JpaRepository<PackagingReturnEntity, Long> {
    List<PackagingReturnEntity> findByRunId(Long runId);

    /** [cliente, vacias devueltas] hasta el dia indicado (inclusive). */
    @Query("select e.clientId, coalesce(sum(e.boxes), 0) from PackagingReturnEntity e where e.day <= :day group by e.clientId")
    List<Object[]> sumByClientUpTo(@Param("day") LocalDate day);

    List<PackagingReturnEntity> findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(Long clientId, LocalDate day, Pageable page);
}
