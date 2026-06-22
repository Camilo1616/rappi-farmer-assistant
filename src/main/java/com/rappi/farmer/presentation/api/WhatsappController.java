package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.services.WhatsappService;
import com.rappi.farmer.domain.repositories.StoreRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/api/whatsapp")
@RequiredArgsConstructor
public class WhatsappController {

    private final WhatsappService whatsappService;
    private final StoreRepository storeRepository;
    private final SessionContext sessionContext;
    private final com.rappi.farmer.application.services.MessageTemplateService messageTemplateService;
    private final com.rappi.farmer.domain.repositories.UserRepository userRepository;

    private final ExecutorService executor = Executors.newCachedThreadPool();

    /** ID del usuario autenticado. Nunca null en endpoints protegidos por Spring Security. */
    private Long currentUserId() {
        return sessionContext.getCurrentUserId();
    }

    @PostMapping("/open")
    public ResponseEntity<?> openChrome() {
        try {
            whatsappService.abrirChrome(currentUserId());
            return ResponseEntity.ok(Map.of("message", "Servicio WhatsApp iniciado para tu sesión"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/close")
    public ResponseEntity<?> closeChrome() {
        whatsappService.cerrarChrome(currentUserId());
        return ResponseEntity.ok(Map.of("message", "Chrome cerrado"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logoutSession() {
        whatsappService.logoutSession(currentUserId());
        return ResponseEntity.ok(Map.of("message", "Sesión cerrada — escanea QR para reconectar"));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Long userId       = currentUserId();
        boolean connected = whatsappService.estaConectado(userId);
        boolean hasQr     = whatsappService.tieneQr(userId);
        long    sentToday = whatsappService.enviadosHoy(userId);

        final int WA_LIMIT = 35;
        int remaining = Math.max(0, WA_LIMIT - (int) sentToday);

        java.util.Map<String, Object> resp = new java.util.HashMap<>();
        resp.put("open",      connected || hasQr);
        resp.put("connected", connected);
        resp.put("hasQr",     hasQr);
        resp.put("sentToday", sentToday);
        resp.put("remaining", remaining);
        resp.put("waLimit",   WA_LIMIT);
        resp.put("pendingSetup", false);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/qr")
    public ResponseEntity<?> getQr() {
        Long userId = currentUserId();
        String qr   = whatsappService.obtenerQr(userId);
        if (qr == null) return ResponseEntity.ok(Map.of("qr", (Object) null,
                "connected", whatsappService.estaConectado(userId)));
        return ResponseEntity.ok(Map.of("qr", qr, "connected", false));
    }

    @GetMapping("/wait-connection")
    public ResponseEntity<Map<String, Object>> waitConnection(
            @RequestParam(defaultValue = "60") int timeout) {
        boolean connected = whatsappService.esperarConexion(currentUserId(), timeout);
        return ResponseEntity.ok(Map.of("connected", connected));
    }

    @PostMapping("/test")
    public ResponseEntity<?> sendTest(@Valid @RequestBody TestRequest request) {
        String result = whatsappService.enviarPrueba(currentUserId(), request.phone(), request.message());
        return ResponseEntity.ok(Map.of("result", result));
    }

    @PostMapping(value = "/send", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter sendMasivo(@Valid @RequestBody SendRequest request) {
        final int WA_LIMIT = 35;
        Long userId = currentUserId();
        long sentToday = whatsappService.enviadosHoy(userId);
        int remaining  = Math.max(0, WA_LIMIT - (int) sentToday);

        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);

        // El frontend ya respeta el límite; aquí solo recortamos como red de seguridad
        List<StoreViewDto> stores = request.storeIds().stream()
                .limit(Math.max(remaining, 0))
                .map(id -> storeRepository.findById(id).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(store -> new StoreViewDto(
                        store.getId(), store.getStoreCode(), store.getBrandId(), store.getStoreName(),
                        store.getPhoneNumber(), 0, null,
                        store.getConnectionPercentage(), store.getCurrentStatus(),
                        null, null, null, store.getHadHandoff(), store.getLastLoginDate(),
                        null, null, null, null, store.getFarmerEmail(), store.getFarmerId(),
                        null, null, null, null, null, store.getChannel(), null))
                .toList();

        executor.submit(() -> {
            try {
                whatsappService.enviarMasivo(stores, request.template(), userId, progress -> {
                    try {
                        emitter.send(SseEmitter.event().name("progress").data(progress));
                        if (progress.isFinalizado()) emitter.complete();
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                    }
                });
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    @PostMapping(value = "/send-personalized", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter sendPersonalized(@Valid @RequestBody SendPersonalizedRequest request) {
        final int WA_LIMIT = 35;
        Long userId = currentUserId();
        long sentToday = whatsappService.enviadosHoy(userId);
        int remaining  = Math.max(0, WA_LIMIT - (int) sentToday);

        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);

        Map<Long, String> messageMap = request.storeMessages().stream()
                .limit(Math.max(remaining, 0))
                .collect(java.util.stream.Collectors.toMap(StoreMessage::storeId, StoreMessage::message));

        List<StoreViewDto> stores = request.storeMessages().stream()
                .limit(Math.max(remaining, 0))
                .map(sm -> storeRepository.findById(sm.storeId()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(store -> new StoreViewDto(
                        store.getId(), store.getStoreCode(), store.getBrandId(), store.getStoreName(),
                        store.getPhoneNumber(), 0, null,
                        store.getConnectionPercentage(), store.getCurrentStatus(),
                        null, null, null, store.getHadHandoff(), store.getLastLoginDate(),
                        null, null, null, null, store.getFarmerEmail(), store.getFarmerId(),
                        null, null, null, null, null, store.getChannel(), null))
                .toList();

        executor.submit(() -> {
            try {
                whatsappService.enviarMasivoPersonalizado(stores, messageMap, userId, progress -> {
                    try {
                        emitter.send(SseEmitter.event().name("progress").data(progress));
                        if (progress.isFinalizado()) emitter.complete();
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                    }
                });
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    @GetMapping("/templates")
    public ResponseEntity<?> getTemplates() {
        return ResponseEntity.ok(messageTemplateService.getAll());
    }

    @GetMapping("/sent-today")
    public ResponseEntity<?> getStoresSentToday() {
        return ResponseEntity.ok(whatsappService.storesConWaHoy(currentUserId()));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(@RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(whatsappService.historial(currentUserId(), days));
    }

    public record TestRequest(@NotBlank String phone, @NotBlank String message) {}
    public record SendRequest(@NotEmpty List<Long> storeIds, @NotBlank String template) {}
    public record StoreMessage(Long storeId, String message) {}
    public record SendPersonalizedRequest(@NotEmpty List<StoreMessage> storeMessages) {}
}
