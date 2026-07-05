package com.rappi.assistant.application.services;

import com.rappi.assistant.application.dtos.WhatsappContactDto;
import com.rappi.assistant.application.dtos.WhatsappSendProgress;
import com.rappi.assistant.domain.repositories.WhatsappMessageRepository;
import com.rappi.assistant.infrastructure.selenium.WhatsappDriver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsappService {

    private static final int MAX_DIARIO    = 40;
    private static final int DELAY_MIN_MS  = 10_000;
    private static final int DELAY_MAX_MS  = 25_000;
    private static final int TICK_MS       = 500;   // granularidad del sleep para responder a pause rápido

    private final WhatsappDriver whatsappDriver;
    private final WhatsappMessageRepository whatsappMessageRepository;

    private final Random random = new Random();

    // ── Pause/resume por userId ───────────────────────────────────────────────
    private final ConcurrentHashMap<Long, AtomicBoolean> pauseFlags = new ConcurrentHashMap<>();

    private AtomicBoolean pauseFlag(Long userId) {
        return pauseFlags.computeIfAbsent(userId, k -> new AtomicBoolean(false));
    }

    public void pauseSend(Long userId)  { pauseFlag(userId).set(true);  log.info("[WA:u{}] Envío pausado",  userId); }
    public void resumeSend(Long userId) { pauseFlag(userId).set(false); log.info("[WA:u{}] Envío reanudado", userId); }
    public boolean isPaused(Long userId) { return pauseFlag(userId).get(); }

    /**
     * Espera {@code ms} ms respetando la pausa. Devuelve false si el hilo fue interrumpido.
     * Mientras está pausado emite eventos PAUSADO al callback.
     */
    private boolean sleepWithPause(long ms, Long userId, WhatsappSendProgress pausedProgress,
                                   Consumer<WhatsappSendProgress> cb) {
        long remaining = ms;
        while (remaining > 0) {
            if (Thread.currentThread().isInterrupted()) return false;
            while (pauseFlag(userId).get()) {
                cb.accept(pausedProgress);
                try { Thread.sleep(TICK_MS); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); return false;
                }
            }
            long tick = Math.min(TICK_MS, remaining);
            try { Thread.sleep(tick); } catch (InterruptedException e) {
                Thread.currentThread().interrupt(); return false;
            }
            remaining -= tick;
        }
        return true;
    }

    /** Construye el sessionId del farmer a partir de su userId. */
    public static String sessionId(Long userId) {
        return userId != null ? "u" + userId : "default";
    }

    // ── Estado ────────────────────────────────────────────────────────────────

    public void abrirChrome(Long userId) {
        whatsappDriver.abrir(sessionId(userId));
    }

    public boolean esperarConexion(Long userId, int timeoutSegundos) {
        return whatsappDriver.esperarConexion(sessionId(userId), timeoutSegundos);
    }

    public boolean estaConectado(Long userId) {
        return whatsappDriver.estaConectado(sessionId(userId));
    }

    public boolean chromeAbierto(Long userId) {
        return whatsappDriver.estaAbierto(sessionId(userId));
    }

    public boolean verificarEstadoReal(Long userId) {
        return whatsappDriver.verificarEstadoReal(sessionId(userId));
    }

    public void cerrarChrome(Long userId) {
        whatsappDriver.cerrar(sessionId(userId));
    }

    public void logoutSession(Long userId) {
        whatsappDriver.logout(sessionId(userId));
    }

    public boolean tieneQr(Long userId) {
        return whatsappDriver.obtenerQr(sessionId(userId)) != null;
    }

    public String obtenerQr(Long userId) {
        return whatsappDriver.obtenerQr(sessionId(userId));
    }

    /** Envía un único mensaje de prueba sin guardarlo en el log. */
    public String enviarPrueba(Long userId, String telefono, String mensaje) {
        return whatsappDriver.enviarMensaje(telefono, mensaje, sessionId(userId));
    }

    public long enviadosHoy(Long userId) {
        return whatsappMessageRepository.countSentTodayByUser(userId);
    }

    public java.util.List<java.util.Map<String, Object>> storesConWaHoy(Long userId) {
        return whatsappMessageRepository.findStoresSentToday(userId);
    }

    public java.util.List<java.util.Map<String, Object>> historial(Long userId, int days) {
        return whatsappMessageRepository.findHistory(userId, days);
    }

    // ── Envío masivo ──────────────────────────────────────────────────────────

    public void enviarMasivo(List<WhatsappContactDto> contactos, String template, Long userId,
                              Consumer<WhatsappSendProgress> progressCallback) {
        pauseFlag(userId).set(false); // resetear pausa al iniciar
        String session = sessionId(userId);
        int total    = Math.min(contactos.size(), MAX_DIARIO);
        int enviados = 0;
        int errores  = 0;

        for (int i = 0; i < total; i++) {
            WhatsappContactDto contacto = contactos.get(i);
            String mensaje = template.replace("{store_name}", contacto.name());

            // Esperar si está pausado antes de enviar
            var waiting = new WhatsappSendProgress(total, i, enviados, errores, contacto.name(), "PAUSADO", false);
            if (!sleepWithPause(0, userId, waiting, progressCallback)) break;

            progressCallback.accept(new WhatsappSendProgress(
                    total, i, enviados, errores, contacto.name(), "ENVIANDO", false));

            String resultado = whatsappDriver.enviarMensaje(contacto.phoneNumber(), mensaje, session);

            if ("ERROR_CHROME_CERRADO".equals(resultado)) {
                progressCallback.accept(new WhatsappSendProgress(
                        total, i + 1, enviados, errores, contacto.name(), "ERROR_CHROME_CERRADO", true));
                log.warn("[WA:{}] Envío masivo abortado — servicio desconectado en contacto {}", session, contacto.name());
                pauseFlag(userId).set(false);
                return;
            }

            whatsappMessageRepository.save(contacto.id(), contacto.name(), userId, mensaje, resultado, null);

            if ("ENVIADO".equals(resultado))             enviados++;
            else if (!"NUMERO_INVALIDO".equals(resultado)) errores++;

            progressCallback.accept(new WhatsappSendProgress(
                    total, i + 1, enviados, errores, contacto.name(), resultado, false));

            if (i < total - 1) {
                int delay = DELAY_MIN_MS + random.nextInt(DELAY_MAX_MS - DELAY_MIN_MS);
                var waitProg = new WhatsappSendProgress(total, i + 1, enviados, errores, contacto.name(), "ESPERANDO", false, delay / 1000);
                progressCallback.accept(waitProg);
                log.debug("[WA:{}] Esperando {}ms antes del siguiente mensaje", session, delay);
                var pausedProg = new WhatsappSendProgress(total, i + 1, enviados, errores, contacto.name(), "PAUSADO", false);
                if (!sleepWithPause(delay, userId, pausedProg, progressCallback)) break;
            }
        }

        pauseFlag(userId).set(false);
        progressCallback.accept(new WhatsappSendProgress(
                total, total, enviados, errores, "", "COMPLETADO", true));
        log.info("[WA:{}] Envío masivo completado — enviados:{} errores:{}", session, enviados, errores);
    }

    public void enviarMasivoPersonalizado(List<WhatsappContactDto> contactos, Map<Long, String> messageMap,
                                          Long userId, Consumer<WhatsappSendProgress> progressCallback) {
        pauseFlag(userId).set(false);
        String session = sessionId(userId);
        int total    = Math.min(contactos.size(), MAX_DIARIO);
        int enviados = 0;
        int errores  = 0;

        for (int i = 0; i < total; i++) {
            WhatsappContactDto contacto = contactos.get(i);
            String mensaje = messageMap.getOrDefault(contacto.id(), "");

            var waiting = new WhatsappSendProgress(total, i, enviados, errores, contacto.name(), "PAUSADO", false);
            if (!sleepWithPause(0, userId, waiting, progressCallback)) break;

            progressCallback.accept(new WhatsappSendProgress(
                    total, i, enviados, errores, contacto.name(), "ENVIANDO", false));

            String resultado = whatsappDriver.enviarMensaje(contacto.phoneNumber(), mensaje, session);

            if ("ERROR_CHROME_CERRADO".equals(resultado)) {
                progressCallback.accept(new WhatsappSendProgress(
                        total, i + 1, enviados, errores, contacto.name(), "ERROR_CHROME_CERRADO", true));
                pauseFlag(userId).set(false);
                return;
            }

            whatsappMessageRepository.save(contacto.id(), contacto.name(), userId, mensaje, resultado, null);

            if ("ENVIADO".equals(resultado))             enviados++;
            else if (!"NUMERO_INVALIDO".equals(resultado)) errores++;

            progressCallback.accept(new WhatsappSendProgress(
                    total, i + 1, enviados, errores, contacto.name(), resultado, false));

            if (i < total - 1) {
                int delay = DELAY_MIN_MS + random.nextInt(DELAY_MAX_MS - DELAY_MIN_MS);
                var waitProg   = new WhatsappSendProgress(total, i + 1, enviados, errores, contacto.name(), "ESPERANDO", false, delay / 1000);
                var pausedProg = new WhatsappSendProgress(total, i + 1, enviados, errores, contacto.name(), "PAUSADO",   false);
                progressCallback.accept(waitProg);
                if (!sleepWithPause(delay, userId, pausedProg, progressCallback)) break;
            }
        }

        pauseFlag(userId).set(false);
        progressCallback.accept(new WhatsappSendProgress(
                total, total, enviados, errores, "", "COMPLETADO", true));
        log.info("[WA:{}] Envío personalizado completado — enviados:{} errores:{}", session, enviados, errores);
    }
}
