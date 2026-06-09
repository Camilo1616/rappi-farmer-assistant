package com.rappi.farmer.domain.repositories;

import java.util.List;
import java.util.Map;

public interface WhatsappMessageRepository {
    void save(Long storeId, Long userId, String message, String status, String errorMessage);
    long countSentToday();
    void deleteByStoreId(Long storeId);
    List<Map<String, Object>> findStoresSentToday(Long userId);
    List<Map<String, Object>> findHistory(Long userId, int days);
}
