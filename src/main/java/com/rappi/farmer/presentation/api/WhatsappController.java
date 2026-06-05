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

    private final ExecutorService executor = Executors.newCachedThreadPool();

    @PostMapping("/open")
    public ResponseEntity<?> openChrome() {
        try {
            whatsappService.abrirChrome();
            return ResponseEntity.ok(Map.of("message", "Chrome abierto"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/close")
    public ResponseEntity<?> closeChrome() {
        whatsappService.cerrarChrome();
        return ResponseEntity.ok(Map.of("message", "Chrome cerrado"));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        boolean open = whatsappService.chromeAbierto();
        boolean connected = open && whatsappService.estaConectado();
        long sentToday = whatsappService.enviadosHoy();
        return ResponseEntity.ok(Map.of(
                "open", open,
                "connected", connected,
                "sentToday", sentToday,
                "remaining", Math.max(0, 40 - sentToday)
        ));
    }

    @GetMapping("/wait-connection")
    public ResponseEntity<Map<String, Object>> waitConnection(
            @RequestParam(defaultValue = "60") int timeout) {
        boolean connected = whatsappService.esperarConexion(timeout);
        return ResponseEntity.ok(Map.of("connected", connected));
    }

    @PostMapping("/test")
    public ResponseEntity<?> sendTest(@Valid @RequestBody TestRequest request) {
        String result = whatsappService.enviarPrueba(request.phone(), request.message());
        return ResponseEntity.ok(Map.of("result", result));
    }

    @PostMapping(value = "/send", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter sendMasivo(@Valid @RequestBody SendRequest request) {
        Long userId = sessionContext.getCurrentUserId();

        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);

        List<StoreViewDto> stores = request.storeIds().stream()
                .map(id -> storeRepository.findById(id).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(store -> new StoreViewDto(
                        store.getId(), store.getStoreCode(), store.getStoreName(),
                        store.getPhoneNumber(), 0, null,
                        store.getConnectionPercentage(), store.getCurrentStatus(),
                        null, null, null, store.getHadHandoff(), store.getLastLoginDate(), null, null, null, null, store.getFarmerEmail()))
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

    public record TestRequest(@NotBlank String phone, @NotBlank String message) {}

    public record SendRequest(@NotEmpty List<Long> storeIds, @NotBlank String template) {}
}
