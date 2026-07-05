package com.rappi.assistant.domain.repositories;

import java.util.List;
import java.util.Map;

public interface WhatsappMessageRepository {
    void save(Long contactId, String contactName, Long userId, String message, String status, String errorMessage);
    long countSentToday();
    long countSentTodayByUser(Long userId);
    List<Map<String, Object>> findStoresSentToday(Long userId);
    List<Map<String, Object>> findHistory(Long userId, int days);
}
