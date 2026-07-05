package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.GoogleSheetsCredentialEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoogleSheetsCredentialJpaRepository extends JpaRepository<GoogleSheetsCredentialEntity, Long> {
}
