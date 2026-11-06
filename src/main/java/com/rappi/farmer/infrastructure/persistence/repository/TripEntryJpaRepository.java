package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.TripEntryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TripEntryJpaRepository extends JpaRepository<TripEntryEntity, Long> {
    List<TripEntryEntity> findByTripIdIn(List<Long> tripIds);

    void deleteByTripId(Long tripId);

    /** [dia, tipo, total] de las lineas de viaje dentro del rango. */
    @Query("select t.day, e.type, coalesce(sum(e.amount), 0) from TripEntryEntity e, TripEntity t "
            + "where e.tripId = t.id and t.day between :from and :to group by t.day, e.type")
    List<Object[]> totalsByDay(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
