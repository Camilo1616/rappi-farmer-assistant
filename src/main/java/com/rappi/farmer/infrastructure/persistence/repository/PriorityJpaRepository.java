package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.PriorityEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PriorityJpaRepository extends JpaRepository<PriorityEntity, Long> {
}
