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

    /** Total facturado (cajas entregadas x precio) por cliente hasta el dia indicado (inclusive). */
    @Query("select e.clientId, coalesce(sum(e.deliveredBoxes * e.unitPrice), 0) from DispatchLineEntity e "
            + "where e.day <= :day group by e.clientId")
    List<Object[]> billedUpTo(@Param("day") LocalDate day);

    /** Por dia y categoria: [dia, categoria, entregadas, pedidas, valor facturado]. */
    @Query("select e.day, e.category, coalesce(sum(e.deliveredBoxes), 0), coalesce(sum(e.orderedBoxes), 0), "
            + "coalesce(sum(e.deliveredBoxes * e.unitPrice), 0) from DispatchLineEntity e "
            + "where e.day between :from and :to group by e.day, e.category")
    List<Object[]> summaryByDay(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Ultimas compras de un cliente: [dia, cajas entregadas, valor], mas reciente primero. */
    @Query("select e.day, coalesce(sum(e.deliveredBoxes), 0), coalesce(sum(e.deliveredBoxes * e.unitPrice), 0) "
            + "from DispatchLineEntity e where e.clientId = :clientId and e.day <= :day and e.deliveredBoxes > 0 "
            + "group by e.day order by e.day desc")
    List<Object[]> lastPurchases(@Param("clientId") Long clientId, @Param("day") LocalDate day,
                                 org.springframework.data.domain.Pageable page);

    /** Cajas entregadas por cliente hasta el dia (sin bolsas): base del empaque que debe cada cliente. */
    @Query("select e.clientId, coalesce(sum(e.deliveredBoxes), 0) from DispatchLineEntity e "
            + "where e.day <= :day and e.category <> 'BOLSAS' group by e.clientId")
    List<Object[]> returnableBoxesUpTo(@Param("day") LocalDate day);
}
