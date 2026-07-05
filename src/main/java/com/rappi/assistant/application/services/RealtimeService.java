package com.rappi.assistant.application.services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Publica eventos en tiempo real a todos los clientes conectados vía WebSocket.
 * Cualquier servicio que modifique datos visibles en el dashboard debe llamar
 * a los métodos de esta clase después de persistir los cambios.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RealtimeService {

    private final SimpMessagingTemplate messagingTemplate;

    /** Notifica que una tienda fue actualizada (gestión, prioridad, HO, etc.) */
    public void storeUpdated(Long storeId, String event) {
        Map<String, Object> payload = Map.of(
                "type", event,
                "storeId", storeId
        );
        messagingTemplate.convertAndSend("/topic/stores", payload);
        log.debug("WS → /topic/stores  type={} storeId={}", event, storeId);
    }

    /** Notifica que las métricas del dashboard cambiaron */
    public void metricsUpdated(Long userId) {
        Map<String, Object> payload = Map.of(
                "type", "METRICS_UPDATED",
                "userId", userId
        );
        messagingTemplate.convertAndSend("/topic/stores", payload);
    }
}
