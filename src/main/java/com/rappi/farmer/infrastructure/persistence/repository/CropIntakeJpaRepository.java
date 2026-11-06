package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.CropIntakeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CropIntakeJpaRepository extends JpaRepository<CropIntakeEntity, Long> {
    List<CropIntakeEntity> findByDay(LocalDate day);

    Optional<CropIntakeEntity> findByDayAndCropIdAndCategory(LocalDate day, Long cropId, String category);

    /** Cajas recibidas de cultivos por categoria hasta el dia indicado (inclusive). */
    @Query("select e.category, coalesce(sum(e.boxes), 0) from CropIntakeEntity e where e.day <= :day group by e.category")
    List<Object[]> sumUpTo(@Param("day") LocalDate day);

    /** [dia, categoria, cajas] dentro del rango. */
    @Query("select e.day, e.category, coalesce(sum(e.boxes), 0) from CropIntakeEntity e "
            + "where e.day between :from and :to group by e.day, e.category")
    List<Object[]> sumByDay(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** [dia, costo de compra] dentro del rango. */
    @Query("select e.day, coalesce(sum(e.boxes * e.unitPrice), 0) from CropIntakeEntity e "
            + "where e.day between :from and :to group by e.day")
    List<Object[]> costByDay(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
