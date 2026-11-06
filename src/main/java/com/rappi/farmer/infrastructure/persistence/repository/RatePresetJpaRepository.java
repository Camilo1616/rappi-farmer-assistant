package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.RatePresetEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RatePresetJpaRepository extends JpaRepository<RatePresetEntity, Long> {
    List<RatePresetEntity> findAllByOrderByKindAscConceptAsc();
}
