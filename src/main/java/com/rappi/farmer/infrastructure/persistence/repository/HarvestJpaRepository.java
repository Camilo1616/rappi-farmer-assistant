package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.HarvestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HarvestJpaRepository extends JpaRepository<HarvestEntity, Long> {
    Optional<HarvestEntity> findByDayAndCategory(LocalDate day, String category);

    List<HarvestEntity> findByDay(LocalDate day);

    /** Total de cajas por categoria hasta el dia indicado (inclusive). */
    @Query("select e.category, coalesce(sum(e.boxes), 0) from HarvestEntity e where e.day <= :day group by e.category")
    List<Object[]> sumUpTo(@Param("day") LocalDate day);
}
