package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.BaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BaseJpaRepository extends JpaRepository<BaseEntity, Long> {
    List<BaseEntity> findByLiderIdOrderByCreatedAtDesc(Long liderId);
}
