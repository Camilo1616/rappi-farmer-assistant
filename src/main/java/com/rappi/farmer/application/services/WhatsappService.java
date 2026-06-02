package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.dtos.WhatsappSendProgress;
import com.rappi.farmer.domain.repositories.WhatsappMessageRepository;
import com.rappi.farmer.infrastructure.selenium.WhatsappDriver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Random;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsappService {

    private static final int MAX_DIARIO = 40;
    private static final int DELAY_MIN_MS = 10_000;
    private static final int DELAY_MAX_MS = 25_000;

    private final WhatsappDriver whatsappDriver;
    private final WhatsappMessageRepository whatsappMessageRepository;

    private final Random random = new Random();

    /** Abre Chrome con la sesión guardada. */
    public void abrirChrome() {
        whatsappDriver.abrir();
    }

    /**
     * Espera a que WhatsApp Web esté conectado.
     * @return true si la sesión está activa
     */
    public boolean esperarConexion(int timeoutSegundos) {
        return whatsappDriver.esperarConexion(timeoutSegundos);
    }

    public boolean estaConectado() {
        return whatsappDriver.estaConectado();
    }

    public boolean chromeAbierto() {
        return whatsappDriver.estaAbierto();
    }

    /** Verifica si Chrome sigue vivo y conectado. Limpia el driver si fue cerrado. */
    public boolean verificarEstadoReal() {
        return whatsappDriver.verificarEstadoReal();
    }

    public void cerrarChrome() {
        whatsappDriver.cerrar();
    }

    /** Envía un único mensaje de prueba sin guardarlo en el log. */
    public String enviarPrueba(String telefono, String mensaje) {
        return whatsappDriver.enviarMensaje(telefono, mensaje);
    }

    /**
     * Cuántos mensajes ya fueron enviados hoy (para el límite de 40).
     */
    public long enviadosHoy() {
        return whatsappMessageRepository.countSentToday();
    }

    /**
     * Envía mensajes masivos a las tiendas indicadas.
     * Corre en el hilo que lo llama — el caller debe usar un hilo separado (no el hilo HTTP).
     *
     * @param stores          tiendas seleccionadas
     * @param template        plantilla con variable {store_name}
     * @param progressCallback callback invocado tras cada mensaje (puede ser desde hilo no-FX)
     */
    public void enviarMasivo(List<StoreViewDto> stores, String template, Long userId,
                              Consumer<WhatsappSendProgress> progressCallback) {

        int total = Math.min(stores.size(), MAX_DIARIO);
        int enviados = 0;
        int errores = 0;

        for (int i = 0; i < total; i++) {
            StoreViewDto store = stores.get(i);
            String mensaje = template.replace("{store_name}", store.getStoreName());

            // Notifica inicio
            progressCallback.accept(new WhatsappSendProgress(
                    total, i, enviados, errores, store.getStoreName(), "ENVIANDO", false));

            String resultado = whatsappDriver.enviarMensaje(store.getPhoneNumber(), mensaje);

            // Chrome fue cerrado mientras se enviaba — abortar todo el envío
            if ("ERROR_CHROME_CERRADO".equals(resultado)) {
                progressCallback.accept(new WhatsappSendProgress(
                        total, i + 1, enviados, errores, store.getStoreName(), "ERROR_CHROME_CERRADO", true));
                log.warn("Envío masivo abortado — Chrome fue cerrado");
                return;
            }

            whatsappMessageRepository.save(store.getId(), userId, mensaje, resultado, null);

            if ("ENVIADO".equals(resultado)) {
                enviados++;
            } else if (!"NUMERO_INVALIDO".equals(resultado)) {
                errores++;
            }

            boolean esOmitido = false; // intentar siempre, nunca omitir

            // Notifica resultado de este mensaje
            progressCallback.accept(new WhatsappSendProgress(
                    total, i + 1, enviados, errores, store.getStoreName(), resultado, false));

            // Delay aleatorio solo cuando realmente se envió (no gastar tiempo en omitidos)
            if (i < total - 1 && !esOmitido) {
                int delay = DELAY_MIN_MS + random.nextInt(DELAY_MAX_MS - DELAY_MIN_MS);
                int delaySeg = delay / 1000;
                progressCallback.accept(new WhatsappSendProgress(
                        total, i + 1, enviados, errores, store.getStoreName(), "ESPERANDO", false, delaySeg));
                log.debug("Esperando {}ms antes del siguiente mensaje", delay);
                try {
                    Thread.sleep(delay);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.warn("Envío interrumpido en tienda {}", store.getStoreName());
                    break;
                }
            }
        }

        // Notifica finalización
        progressCallback.accept(new WhatsappSendProgress(
                total, total, enviados, errores, "", "COMPLETADO", true));

        log.info("Envío masivo completado — enviados:{} errores:{}", enviados, errores);
    }

}
