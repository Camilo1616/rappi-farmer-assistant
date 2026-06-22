package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.dtos.WhatsappSendProgress;
import com.rappi.farmer.domain.repositories.WhatsappMessageRepository;
import com.rappi.farmer.infrastructure.selenium.WhatsappDriver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsappService {

    private static final int MAX_DIARIO   = 40;
    private static final int DELAY_MIN_MS = 10_000;
    private static final int DELAY_MAX_MS = 25_000;

    private final WhatsappDriver whatsappDriver;
    private final WhatsappMessageRepository whatsappMessageRepository;

    private final Random random = new Random();

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

    public void enviarMasivo(List<StoreViewDto> stores, String template, Long userId,
                              Consumer<WhatsappSendProgress> progressCallback) {
        String session = sessionId(userId);
        int total  = Math.min(stores.size(), MAX_DIARIO);
        int enviados = 0;
        int errores  = 0;

        for (int i = 0; i < total; i++) {
            StoreViewDto store = stores.get(i);
            String mensaje = template.replace("{store_name}", store.getStoreName());

            progressCallback.accept(new WhatsappSendProgress(
                    total, i, enviados, errores, store.getStoreName(), "ENVIANDO", false));

            String resultado = whatsappDriver.enviarMensaje(store.getPhoneNumber(), mensaje, session);

            if ("ERROR_CHROME_CERRADO".equals(resultado)) {
                progressCallback.accept(new WhatsappSendProgress(
                        total, i + 1, enviados, errores, store.getStoreName(), "ERROR_CHROME_CERRADO", true));
                log.warn("[WA:{}] Envío masivo abortado — servicio desconectado", session);
                return;
            }

            whatsappMessageRepository.save(store.getId(), userId, mensaje, resultado, null);

            if ("ENVIADO".equals(resultado))            enviados++;
            else if (!"NUMERO_INVALIDO".equals(resultado)) errores++;

            progressCallback.accept(new WhatsappSendProgress(
                    total, i + 1, enviados, errores, store.getStoreName(), resultado, false));

            if (i < total - 1) {
                int delay = DELAY_MIN_MS + random.nextInt(DELAY_MAX_MS - DELAY_MIN_MS);
                progressCallback.accept(new WhatsappSendProgress(
                        total, i + 1, enviados, errores, store.getStoreName(), "ESPERANDO", false, delay / 1000));
                log.debug("[WA:{}] Esperando {}ms antes del siguiente mensaje", session, delay);
                try { Thread.sleep(delay); }
                catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.warn("[WA:{}] Envío interrumpido en tienda {}", session, store.getStoreName());
                    break;
                }
            }
        }

        progressCallback.accept(new WhatsappSendProgress(
                total, total, enviados, errores, "", "COMPLETADO", true));

        log.info("[WA:{}] Envío masivo completado — enviados:{} errores:{}", session, enviados, errores);
    }

    public void enviarMasivoPersonalizado(List<StoreViewDto> stores, Map<Long, String> messageMap,
                                          Long userId, Consumer<WhatsappSendProgress> progressCallback) {
        String session = sessionId(userId);
        int total  = Math.min(stores.size(), MAX_DIARIO);
        int enviados = 0;
        int errores  = 0;

        for (int i = 0; i < total; i++) {
            StoreViewDto store   = stores.get(i);
            String       mensaje = messageMap.getOrDefault(store.getId(), "");

            progressCallback.accept(new WhatsappSendProgress(
                    total, i, enviados, errores, store.getStoreName(), "ENVIANDO", false));

            String resultado = whatsappDriver.enviarMensaje(store.getPhoneNumber(), mensaje, session);

            if ("ERROR_CHROME_CERRADO".equals(resultado)) {
                progressCallback.accept(new WhatsappSendProgress(
                        total, i + 1, enviados, errores, store.getStoreName(), "ERROR_CHROME_CERRADO", true));
                return;
            }

            whatsappMessageRepository.save(store.getId(), userId, mensaje, resultado, null);

            if ("ENVIADO".equals(resultado))            enviados++;
            else if (!"NUMERO_INVALIDO".equals(resultado)) errores++;

            progressCallback.accept(new WhatsappSendProgress(
                    total, i + 1, enviados, errores, store.getStoreName(), resultado, false));

            if (i < total - 1) {
                int delay = DELAY_MIN_MS + random.nextInt(DELAY_MAX_MS - DELAY_MIN_MS);
                progressCallback.accept(new WhatsappSendProgress(
                        total, i + 1, enviados, errores, store.getStoreName(), "ESPERANDO", false, delay / 1000));
                try { Thread.sleep(delay); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
            }
        }

        progressCallback.accept(new WhatsappSendProgress(
                total, total, enviados, errores, "", "COMPLETADO", true));

        log.info("[WA:{}] Envío personalizado completado — enviados:{} errores:{}", session, enviados, errores);
    }
}
