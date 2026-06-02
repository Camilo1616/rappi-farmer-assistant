package com.rappi.farmer.application.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.Desktop;
import java.io.*;
import java.net.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Maneja el flujo OAuth 2.0 de Google para aplicaciones de escritorio.
 * Abre el navegador para autenticar y usa un servidor local para recibir el callback.
 */
@Slf4j
@Service
public class GoogleOAuthService {

    private static final String AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL  = "https://oauth2.googleapis.com/token";
    private static final int    CALLBACK_PORT = 8765;
    private static final String REDIRECT_URI  = "http://localhost:" + CALLBACK_PORT;

    @Value("${google.oauth.client-id:}")
    private String clientId;

    @Value("${google.oauth.client-secret:}")
    private String clientSecret;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
                && !clientId.equals("TU_CLIENT_ID_AQUI")
                && clientSecret != null && !clientSecret.isBlank()
                && !clientSecret.equals("TU_CLIENT_SECRET_AQUI");
    }

    /**
     * Inicia el flujo OAuth: abre el navegador y espera el callback.
     * @return email del usuario autenticado con Google
     */
    public String authenticate() throws Exception {
        return authenticate(null);
    }

    public String authenticate(String loginHint) throws Exception {
        String state = randomState();
        String authUrl = buildAuthUrl(state, loginHint);

        CompletableFuture<String> codeFuture = startCallbackServer(state);

        log.info("Abriendo navegador para OAuth: {}", authUrl);
        Desktop.getDesktop().browse(URI.create(authUrl));

        String code = codeFuture.get(2, TimeUnit.MINUTES);
        String email = exchangeCodeForEmail(code);
        log.info("OAuth exitoso — email: {}", email);
        return email;
    }

    private String buildAuthUrl(String state, String loginHint) throws Exception {
        String url = AUTH_URL
                + "?client_id=" + encode(clientId)
                + "&redirect_uri=" + encode(REDIRECT_URI)
                + "&response_type=code"
                + "&scope=" + encode("openid email profile")
                + "&access_type=offline"
                + "&state=" + state
                + "&prompt=select_account";
        if (loginHint != null && !loginHint.isBlank()) {
            url += "&login_hint=" + encode(loginHint);
        }
        return url;
    }

    private CompletableFuture<String> startCallbackServer(String expectedState) {
        CompletableFuture<String> future = new CompletableFuture<>();

        Thread serverThread = new Thread(() -> {
            try (ServerSocket server = new ServerSocket(CALLBACK_PORT)) {
                server.setSoTimeout(120_000);
                try (Socket socket = server.accept()) {
                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(socket.getInputStream()));
                    String requestLine = reader.readLine();
                    log.debug("Callback recibido: {}", requestLine);

                    String code = parseParam(requestLine, "code");
                    String state = parseParam(requestLine, "state");

                    String html;
                    if (code != null && expectedState.equals(state)) {
                        html = successHtml();
                        sendHtmlResponse(socket, html);
                        future.complete(code);
                    } else {
                        html = errorHtml();
                        sendHtmlResponse(socket, html);
                        future.completeExceptionally(
                                new Exception("OAuth cancelado o estado inválido"));
                    }
                }
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        serverThread.setDaemon(true);
        serverThread.start();

        return future;
    }

    private String exchangeCodeForEmail(String code) throws Exception {
        String body = "code=" + encode(code)
                + "&client_id=" + encode(clientId)
                + "&client_secret=" + encode(clientSecret)
                + "&redirect_uri=" + encode(REDIRECT_URI)
                + "&grant_type=authorization_code";

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = client.send(request,
                HttpResponse.BodyHandlers.ofString());

        JsonNode json = objectMapper.readTree(response.body());
        if (!json.has("id_token")) {
            throw new Exception("Google no devolvió id_token: " + response.body());
        }
        return extractEmailFromJwt(json.get("id_token").asText());
    }

    private String extractEmailFromJwt(String idToken) throws Exception {
        String[] parts = idToken.split("\\.");
        if (parts.length < 2) throw new Exception("JWT inválido");
        String payload = new String(
                Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        JsonNode claims = objectMapper.readTree(payload);
        if (!claims.has("email")) throw new Exception("JWT no contiene email");
        return claims.get("email").asText();
    }

    private String parseParam(String requestLine, String param) {
        if (requestLine == null) return null;
        try {
            String path = requestLine.split(" ")[1];
            String query = path.contains("?") ? path.split("\\?", 2)[1] : "";
            for (String pair : query.split("&")) {
                String[] kv = pair.split("=", 2);
                if (kv.length == 2 && param.equals(kv[0]))
                    return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private void sendHtmlResponse(Socket socket, String html) throws IOException {
        OutputStream out = socket.getOutputStream();
        String response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" + html;
        out.write(response.getBytes(StandardCharsets.UTF_8));
        out.flush();
    }

    private String randomState() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String encode(String value) throws Exception {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String successHtml() {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'>"
                + "<style>body{font-family:sans-serif;display:flex;justify-content:center;"
                + "align-items:center;height:100vh;margin:0;background:#e31837;}"
                + ".card{background:white;padding:40px;border-radius:12px;text-align:center;}"
                + "h2{color:#e31837;}p{color:#555;}</style></head><body>"
                + "<div class='card'><h2>✓ Autenticación exitosa</h2>"
                + "<p>Puedes cerrar esta ventana y continuar en la app.</p></div></body></html>";
    }

    private String errorHtml() {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<h2>Error en la autenticación. Cierra esta ventana e intenta de nuevo.</h2>"
                + "</body></html>";
    }
}
