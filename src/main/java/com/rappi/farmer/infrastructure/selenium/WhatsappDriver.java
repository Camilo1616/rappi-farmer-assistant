package com.rappi.farmer.infrastructure.selenium;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Cliente HTTP hacia el microservicio Baileys (whatsapp-service).
 * Reemplaza la implementación anterior basada en Selenium.
 */
@Slf4j
@Component
public class WhatsappDriver {

    @Value("${whatsapp.service.url:http://localhost:3000}")
    private String serviceUrl;

    @Value("${whatsapp.service.api-key:}")
    private String apiKey;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    // ── Estado ────────────────────────────────────────────────────────────────

    public boolean estaAbierto() {
        return fetchStatus().connected || fetchStatus().hasQr;
    }

    public boolean estaConectado() {
        return fetchStatus().connected;
    }

    public boolean verificarEstadoReal() {
        return estaConectado();
    }

    /** Devuelve el QR en base64 para mostrarlo en el frontend, o null si ya está conectado. */
    public String obtenerQr() {
        return fetchStatus().qr;
    }

    // ── Ciclo de vida ─────────────────────────────────────────────────────────

    /** "Abrir" = verificar que el servicio está vivo y listo para escanear QR. */
    public void abrir() {
        StatusResponse s = fetchStatus();
        if (!s.connected && !s.hasQr) {
            // Pedir reconexión si el servicio está caído
            post("/reconnect", Map.of());
        }
        log.info("[WA] Servicio Baileys — conectado:{} qr:{}", s.connected, s.hasQr);
    }

    public void cerrar() {
        // No cerramos el servicio, solo informamos. El servicio sigue corriendo.
        log.info("[WA] cerrar() — el microservicio Baileys sigue activo en segundo plano");
    }

    public boolean esperarConexion(int timeoutSegundos) {
        long deadline = System.currentTimeMillis() + timeoutSegundos * 1000L;
        while (System.currentTimeMillis() < deadline) {
            if (estaConectado()) return true;
            try { Thread.sleep(2000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
        }
        return false;
    }

    // ── Envío ─────────────────────────────────────────────────────────────────

    public String enviarMensaje(String telefono, String mensaje) {
        if (!estaConectado()) return "ERROR_CHROME_CERRADO";
        try {
            var body = mapper.writeValueAsString(Map.of("phone", telefono, "message", mensaje));
            var req  = buildRequest("/send", body);
            var res  = http.send(req, HttpResponse.BodyHandlers.ofString());
            var json = mapper.readValue(res.body(), Map.class);
            String result = (String) json.getOrDefault("result", "ERROR");
            log.debug("[WA] Enviado a {} → {}", telefono, result);
            return result;
        } catch (Exception e) {
            log.error("[WA] Error enviando a {}: {}", telefono, e.getMessage());
            return "ERROR";
        }
    }

    // ── Internos ──────────────────────────────────────────────────────────────

    private StatusResponse fetchStatus() {
        try {
            var req = HttpRequest.newBuilder()
                    .uri(URI.create(serviceUrl + "/status"))
                    .timeout(Duration.ofSeconds(5))
                    .header("x-api-key", apiKey)
                    .GET()
                    .build();
            var res  = http.send(req, HttpResponse.BodyHandlers.ofString());
            var json = mapper.readValue(res.body(), Map.class);
            boolean conn  = Boolean.TRUE.equals(json.get("connected"));
            boolean hasQr = Boolean.TRUE.equals(json.get("hasQr"));
            String  qr    = (String) json.get("qr");
            return new StatusResponse(conn, hasQr, qr);
        } catch (Exception e) {
            log.warn("[WA] No se pudo contactar el servicio Baileys: {}", e.getMessage());
            return new StatusResponse(false, false, null);
        }
    }

    private void post(String path, Object body) {
        try {
            var json = mapper.writeValueAsString(body);
            var req  = buildRequest(path, json);
            http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            log.warn("[WA] POST {} falló: {}", path, e.getMessage());
        }
    }

    private HttpRequest buildRequest(String path, String jsonBody) {
        return HttpRequest.newBuilder()
                .uri(URI.create(serviceUrl + path))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("x-api-key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();
    }

    private record StatusResponse(boolean connected, boolean hasQr, String qr) {}
}
