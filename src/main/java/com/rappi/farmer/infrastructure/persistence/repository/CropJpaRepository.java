package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.CropEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CropJpaRepository extends JpaRepository<CropEntity, Long> {
}
