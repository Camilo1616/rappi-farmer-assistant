package com.rappi.farmer.domain.repositories;

public interface WhatsappMessageRepository {
    void save(Long storeId, Long userId, String message, String status, String errorMessage);
    long countSentToday();
    void deleteByStoreId(Long storeId);
}
