package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.repositories.WhatsappMessageRepository;
import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import com.rappi.farmer.infrastructure.persistence.entity.UserEntity;
import com.rappi.farmer.infrastructure.persistence.entity.WhatsappMessageEntity;
import com.rappi.farmer.infrastructure.persistence.repository.StoreJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.UserJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.WhatsappMessageJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Slf4j
@Repository
@RequiredArgsConstructor
@Transactional
public class WhatsappMessageRepositoryAdapter implements WhatsappMessageRepository {

    private final WhatsappMessageJpaRepository jpaRepository;
    private final StoreJpaRepository storeJpaRepository;
    private final UserJpaRepository userJpaRepository;

    @Override
    public void save(Long storeId, Long userId, String message, String status, String errorMessage) {
        try {
            StoreEntity store = storeJpaRepository.findById(storeId).orElse(null);
            if (store == null) {
                log.warn("No se encontró tienda {} para guardar log de WhatsApp", storeId);
                return;
            }
            UserEntity user = userId != null ? userJpaRepository.findById(userId).orElse(null) : null;
            WhatsappMessageEntity entity = new WhatsappMessageEntity();
            entity.setStore(store);
            entity.setUser(user);
            entity.setMessage(message);
            entity.setStatus(status.startsWith("ERROR") ? "ERROR" : status);
            entity.setErrorMessage(status.startsWith("ERROR") ? status : null);
            entity.setSentAt(LocalDateTime.now());
            jpaRepository.save(entity);
        } catch (Exception e) {
            log.error("Error guardando log de WhatsApp para tienda {}: {}", storeId, e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public long countSentToday() {
        LocalDateTime start = LocalDate.now().atStartOfDay();
        return jpaRepository.countSentToday(start, start.plusDays(1));
    }

    @Override
    public void deleteByStoreId(Long storeId) {
        jpaRepository.deleteByStoreId(storeId);
    }
}
