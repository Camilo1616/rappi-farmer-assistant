package com.rappi.farmer.application.services;

import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.domain.repositories.WhatsappMessageRepository;
import com.rappi.farmer.infrastructure.persistence.repository.PriorityBaseStoreJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.PriorityJpaRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class StoreDeleteService {

    private final PriorityBaseStoreJpaRepository priorityBaseStoreJpaRepository;
    private final PriorityJpaRepository priorityJpaRepository;
    private final ManagementRepository managementRepository;
    private final WhatsappMessageRepository whatsappMessageRepository;
    private final DailyMetricRepository dailyMetricRepository;
    private final StoreRepository storeRepository;
    private final EntityManager entityManager;

    /**
     * Borra una tienda y todos sus hijos en una transacción propia (REQUIRES_NEW).
     * Al ser un bean separado, Spring aplica correctamente el proxy AOP
     * y la transacción no contamina el contexto del llamador.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteStore(Long storeId) {
        priorityBaseStoreJpaRepository.deleteByStoreId(storeId);
        priorityJpaRepository.deleteByStoreId(storeId);
        managementRepository.deleteByStoreId(storeId);
        whatsappMessageRepository.deleteByStoreId(storeId);
        dailyMetricRepository.deleteByStoreId(storeId);
        entityManager.flush();
        storeRepository.deleteById(storeId);
    }
}
