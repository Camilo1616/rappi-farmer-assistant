package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.DashboardSnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DashboardSnapshotJpaRepository extends JpaRepository<DashboardSnapshotEntity, Long> {

    Optional<DashboardSnapshotEntity> findByUserIdAndSnapshotDate(Long userId, LocalDate snapshotDate);

    void deleteByUserIdAndSnapshotDate(Long userId, LocalDate snapshotDate);
}
