package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.WhatsappMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface WhatsappMessageJpaRepository extends JpaRepository<WhatsappMessageEntity, Long> {

    @Query("SELECT COUNT(m) FROM WhatsappMessageEntity m " +
           "WHERE m.status = 'ENVIADO' AND m.sentAt >= :start AND m.sentAt < :end")
    long countSentToday(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("DELETE FROM WhatsappMessageEntity m WHERE m.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("DELETE FROM WhatsappMessageEntity m WHERE m.store.id = :storeId")
    void deleteByStoreId(@Param("storeId") Long storeId);
}
