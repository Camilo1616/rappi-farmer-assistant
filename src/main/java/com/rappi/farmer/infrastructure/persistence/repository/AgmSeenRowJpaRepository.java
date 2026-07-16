package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.AgmSeenRowEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Set;

public interface AgmSeenRowJpaRepository extends JpaRepository<AgmSeenRowEntity, Long> {

    @org.springframework.data.jpa.repository.Query("SELECT r.rowNumber FROM AgmSeenRowEntity r")
    Set<Integer> findAllRowNumbers();
}
