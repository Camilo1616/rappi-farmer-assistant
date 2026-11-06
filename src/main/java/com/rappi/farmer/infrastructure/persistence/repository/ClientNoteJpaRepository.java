package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.ClientNoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClientNoteJpaRepository extends JpaRepository<ClientNoteEntity, Long> {
    List<ClientNoteEntity> findByClientIdOrderByIdDesc(Long clientId);
}
