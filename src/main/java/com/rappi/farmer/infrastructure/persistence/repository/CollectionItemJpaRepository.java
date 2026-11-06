package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.CollectionItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CollectionItemJpaRepository extends JpaRepository<CollectionItemEntity, Long> {
    List<CollectionItemEntity> findByRunId(Long runId);

    boolean existsByRunIdAndClientId(Long runId, Long clientId);

    void deleteByRunId(Long runId);
}
