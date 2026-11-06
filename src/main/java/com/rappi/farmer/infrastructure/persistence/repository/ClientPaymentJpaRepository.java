package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.ClientPaymentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ClientPaymentJpaRepository extends JpaRepository<ClientPaymentEntity, Long> {

    List<ClientPaymentEntity> findByDayOrderByIdAsc(LocalDate day);

    /** Total por cliente y tipo hasta el dia indicado (inclusive). */
    @Query("select p.clientId, p.type, coalesce(sum(p.amount), 0) from ClientPaymentEntity p "
            + "where p.day <= :day group by p.clientId, p.type")
    List<Object[]> sumUpTo(@Param("day") LocalDate day);

    List<ClientPaymentEntity> findTop3ByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(Long clientId, LocalDate day);
}
