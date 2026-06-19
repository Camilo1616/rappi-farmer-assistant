package com.rappi.farmer.infrastructure.selenium;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/**
 * Cliente HTTP hacia el microservicio Baileys (whatsapp-service).
 * Cada farmer tiene su propia sesión identificada por sessionId ("u<userId>").
 * El servicio Node.js mantiene sesiones independientes en disco,
 * por lo que cada farmer escanea su propio QR y envía desde su propio número.
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

    // ── Estado por sesión ─────────────────────────────────────────────────────

    public boolean estaAbierto(String sessionId) {
        StatusResponse s = fetchStatus(sessionId);
        return s.connected() || s.hasQr();
    }

    public boolean estaConectado(String sessionId) {
        return fetchStatus(sessionId).connected();
    }

    public boolean verificarEstadoReal(String sessionId) {
        return estaConectado(sessionId);
    }

    /** Devuelve el QR en base64 para este farmer, o null si ya está conectado. */
    public String obtenerQr(String sessionId) {
        return fetchStatus(sessionId).qr();
    }

    // ── Ciclo de vida ─────────────────────────────────────────────────────────

    /** Verifica que el servicio está vivo e inicia la sesión del farmer si no existe. */
    public void abrir(String sessionId) {
        StatusResponse s = fetchStatus(sessionId);
        // Solo llamar /reconnect si no está conectado, sin QR y sin estar ya inicializando.
        // Si ya está inicializando (Chromium arrancando), no interrumpir con un reset innecesario.
        if (!s.connected() && !s.hasQr() && !s.initializing()) {
            post("/reconnect", Map.of("session", sessionId));
            log.info("[WA:{}] /reconnect enviado — sesión no activa", sessionId);
        } else {
            log.info("[WA:{}] Servicio Baileys — conectado:{} qr:{} inicializando:{}", sessionId, s.connected(), s.hasQr(), s.initializing());
        }
    }

    public void cerrar(String sessionId) {
        log.info("[WA:{}] cerrar() — el microservicio Baileys sigue activo en segundo plano", sessionId);
    }

    public boolean esperarConexion(String sessionId, int timeoutSegundos) {
        long deadline = System.currentTimeMillis() + timeoutSegundos * 1000L;
        while (System.currentTimeMillis() < deadline) {
            if (estaConectado(sessionId)) return true;
            try { Thread.sleep(2000); } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return false;
    }

    // ── Envío ─────────────────────────────────────────────────────────────────

    public String enviarMensaje(String telefono, String mensaje, String sessionId) {
        if (!estaConectado(sessionId)) return "ERROR_CHROME_CERRADO";
        try {
            var body = mapper.writeValueAsString(
                    Map.of("phone", telefono, "message", mensaje, "session", sessionId));
            var req  = buildRequest("/send", body);
            var res  = http.send(req, HttpResponse.BodyHandlers.ofString());
            var json = mapper.readValue(res.body(), Map.class);
            String result = (String) json.getOrDefault("result", "ERROR");
            log.debug("[WA:{}] Enviado a {} → {}", sessionId, telefono, result);
            return result;
        } catch (Exception e) {
            log.error("[WA:{}] Error enviando a {}: {}", sessionId, telefono, e.getMessage());
            return "ERROR";
        }
    }

    // ── Internos ──────────────────────────────────────────────────────────────

    private StatusResponse fetchStatus(String sessionId) {
        try {
            String encodedSession = URLEncoder.encode(sessionId, StandardCharsets.UTF_8);
            var req = HttpRequest.newBuilder()
                    .uri(URI.create(serviceUrl + "/status?session=" + encodedSession))
                    .timeout(Duration.ofSeconds(5))
                    .header("x-api-key", apiKey)
                    .GET()
                    .build();
            var res  = http.send(req, HttpResponse.BodyHandlers.ofString());
            var json = mapper.readValue(res.body(), Map.class);
            boolean conn         = Boolean.TRUE.equals(json.get("connected"));
            boolean hasQr        = Boolean.TRUE.equals(json.get("hasQr"));
            boolean initializing = Boolean.TRUE.equals(json.get("initializing"));
            String  qr           = (String) json.get("qr");
            return new StatusResponse(conn, hasQr, qr, initializing);
        } catch (Exception e) {
            log.warn("[WA:{}] No se pudo contactar el servicio Baileys: {}", sessionId, e.getMessage());
            return new StatusResponse(false, false, null, false);
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

    private record StatusResponse(boolean connected, boolean hasQr, String qr, boolean initializing) {}
}
