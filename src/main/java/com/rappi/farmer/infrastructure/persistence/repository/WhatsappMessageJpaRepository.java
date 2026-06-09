package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import com.rappi.farmer.infrastructure.persistence.entity.WhatsappMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface WhatsappMessageJpaRepository extends JpaRepository<WhatsappMessageEntity, Long> {

    @Query("SELECT COUNT(m) FROM WhatsappMessageEntity m " +
           "WHERE m.status = 'ENVIADO' AND m.sentAt >= :start AND m.sentAt < :end")
    long countSentToday(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /* Tiendas intentadas hoy (cualquier status) — para panel follow-up */
    @Query("SELECT DISTINCT m.store FROM WhatsappMessageEntity m " +
           "WHERE m.sentAt >= :start AND m.sentAt < :end " +
           "AND (:userId IS NULL OR m.user.id = :userId)")
    List<StoreEntity> findStoresSentToday(@Param("start") LocalDateTime start,
                                          @Param("end") LocalDateTime end,
                                          @Param("userId") Long userId);

    /* Historial: últimos N días, con status por mensaje */
    @Query("SELECT m FROM WhatsappMessageEntity m JOIN FETCH m.store LEFT JOIN FETCH m.user " +
           "WHERE m.sentAt >= :since AND (:userId IS NULL OR m.user.id = :userId) " +
           "ORDER BY m.sentAt DESC")
    List<WhatsappMessageEntity> findHistorySince(@Param("since") LocalDateTime since,
                                                  @Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("DELETE FROM WhatsappMessageEntity m WHERE m.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("DELETE FROM WhatsappMessageEntity m WHERE m.store.id = :storeId")
    void deleteByStoreId(@Param("storeId") Long storeId);
}
