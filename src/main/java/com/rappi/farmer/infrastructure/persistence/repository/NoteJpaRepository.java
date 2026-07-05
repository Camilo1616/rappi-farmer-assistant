package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.NoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NoteJpaRepository extends JpaRepository<NoteEntity, Long> {
    List<NoteEntity> findByUserIdOrderByUpdatedAtDesc(Long userId);
}
