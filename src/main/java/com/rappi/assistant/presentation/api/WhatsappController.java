package com.rappi.assistant.presentation.api;

import com.rappi.assistant.application.SessionContext;
import com.rappi.assistant.application.dtos.WhatsappContactDto;
import com.rappi.assistant.application.services.WhatsappService;
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
    private final SessionContext sessionContext;
    private final com.rappi.assistant.application.services.MessageTemplateService messageTemplateService;
    private final com.rappi.assistant.domain.repositories.UserRepository userRepository;

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

    @PostMapping("/pause")
    public ResponseEntity<?> pauseSend() {
        whatsappService.pauseSend(currentUserId());
        return ResponseEntity.ok(Map.of("paused", true));
    }

    @PostMapping("/resume")
    public ResponseEntity<?> resumeSend() {
        whatsappService.resumeSend(currentUserId());
        return ResponseEntity.ok(Map.of("paused", false));
    }

    @GetMapping("/paused")
    public ResponseEntity<?> isPaused() {
        return ResponseEntity.ok(Map.of("paused", whatsappService.isPaused(currentUserId())));
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
        boolean connected = whatsappService.estaConectado(userId);
        Map<String, Object> resp2 = new java.util.HashMap<>();
        resp2.put("qr", qr);
        resp2.put("connected", connected);
        return ResponseEntity.ok(resp2);
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
        List<WhatsappContactDto> contactos = request.contacts().stream()
                .limit(Math.max(remaining, 0))
                .toList();

        executor.submit(() -> {
            try {
                whatsappService.enviarMasivo(contactos, request.template(), userId, progress -> {
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

        List<WhatsappContactDto> contactos = request.storeMessages().stream()
                .limit(Math.max(remaining, 0))
                .map(sm -> new WhatsappContactDto(sm.storeId(), sm.name(), sm.phoneNumber()))
                .toList();

        executor.submit(() -> {
            try {
                whatsappService.enviarMasivoPersonalizado(contactos, messageMap, userId, progress -> {
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
    public record SendRequest(@NotEmpty List<WhatsappContactDto> contacts, @NotBlank String template) {}
    public record StoreMessage(Long storeId, String name, String phoneNumber, String message) {}
    public record SendPersonalizedRequest(@NotEmpty List<StoreMessage> storeMessages) {}
}
