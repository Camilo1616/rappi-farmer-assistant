package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.dtos.WhatsappSendProgress;
import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import com.rappi.farmer.infrastructure.persistence.entity.WhatsappMessageEntity;
import com.rappi.farmer.infrastructure.persistence.repository.StoreJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.WhatsappMessageJpaRepository;
import com.rappi.farmer.infrastructure.selenium.WhatsappDriver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final StoreJpaRepository storeJpaRepository;
    private final WhatsappMessageJpaRepository whatsappMessageJpaRepository;

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
        LocalDateTime start = LocalDate.now().atStartOfDay();
        return whatsappMessageJpaRepository.countSentToday(start, start.plusDays(1));
    }

    /**
     * Envía mensajes masivos a las tiendas indicadas.
     * Corre en el hilo que lo llama — el caller debe usar un Thread/Task de JavaFX.
     *
     * @param stores          tiendas seleccionadas
     * @param template        plantilla con variable {store_name}
     * @param progressCallback callback invocado tras cada mensaje (puede ser desde hilo no-FX)
     */
    public void enviarMasivo(List<StoreViewDto> stores, String template,
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

            // Persiste el resultado
            guardarLog(store.getId(), mensaje, resultado);

            if ("ENVIADO".equals(resultado)) {
                enviados++;
            } else {
                errores++;
            }

            // Notifica resultado de este mensaje
            progressCallback.accept(new WhatsappSendProgress(
                    total, i + 1, enviados, errores, store.getStoreName(), resultado, false));

            // Delay aleatorio entre mensajes (excepto el último)
            if (i < total - 1) {
                int delay = DELAY_MIN_MS + random.nextInt(DELAY_MAX_MS - DELAY_MIN_MS);
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

    private void guardarLog(Long storeId, String mensaje, String resultado) {
        try {
            StoreEntity store = storeJpaRepository.findById(storeId).orElse(null);
            if (store == null) return;

            WhatsappMessageEntity registro = new WhatsappMessageEntity();
            registro.setStore(store);
            registro.setMessage(mensaje);
            registro.setStatus(resultado.startsWith("ERROR") ? "ERROR" : resultado);
            registro.setErrorMessage(resultado.startsWith("ERROR") ? resultado : null);
            registro.setSentAt(LocalDateTime.now());
            whatsappMessageJpaRepository.save(registro);
        } catch (Exception e) {
            log.error("Error guardando log de WhatsApp para tienda {}: {}", storeId, e.getMessage());
        }
    }
}
