package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.SaleOrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleOrderJpaRepository extends JpaRepository<SaleOrderEntity, Long> {
}
