package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.DispatchLineEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DispatchLineJpaRepository extends JpaRepository<DispatchLineEntity, Long> {
    Optional<DispatchLineEntity> findByDayAndClientIdAndCategory(LocalDate day, Long clientId, String category);

    List<DispatchLineEntity> findByDay(LocalDate day);

    /** Total de cajas entregadas por categoria hasta el dia indicado (inclusive). */
    @Query("select e.category, coalesce(sum(e.deliveredBoxes), 0) from DispatchLineEntity e where e.day <= :day group by e.category")
    List<Object[]> sumDeliveredUpTo(@Param("day") LocalDate day);
}
