package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.DiscardEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DiscardJpaRepository extends JpaRepository<DiscardEntity, Long> {
    Optional<DiscardEntity> findByDayAndCategory(LocalDate day, String category);

    List<DiscardEntity> findByDay(LocalDate day);

    /** Total de cajas por categoria hasta el dia indicado (inclusive). */
    @Query("select e.category, coalesce(sum(e.boxes), 0) from DiscardEntity e where e.day <= :day group by e.category")
    List<Object[]> sumUpTo(@Param("day") LocalDate day);

    /** Cajas por dia y categoria dentro del rango (inclusive). */
    @Query("select e.day, e.category, coalesce(sum(e.boxes), 0) from DiscardEntity e "
            + "where e.day between :from and :to group by e.day, e.category")
    List<Object[]> sumByDay(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
