package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.MessageTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MessageTemplateJpaRepository extends JpaRepository<MessageTemplateEntity, Long> {
    Optional<MessageTemplateEntity> findByName(String name);
    boolean existsByName(String name);
}
