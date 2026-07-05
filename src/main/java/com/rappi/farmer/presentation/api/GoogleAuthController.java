package com.rappi.farmer.presentation.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rappi.farmer.application.services.UserService;
import com.rappi.farmer.application.dtos.CreateUserRequest;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.infrastructure.security.JwtService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/auth/google")
@RequiredArgsConstructor
public class GoogleAuthController {

    private static final String AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";

    @Value("${google.oauth.client-id:}")
    private String clientId;

    @Value("${google.oauth.client-secret:}")
    private String clientSecret;

    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String frontendOrigin;

    @Value("${google.oauth.redirect-uri:http://localhost:8080/api/auth/google/callback}")
    private String googleRedirectUri;

    private final UserRepository userRepository;
    private final UserService userService;
    private final JwtService jwtService;
    private final CalendarController calendarController;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Redirige al usuario a Google para autenticarse. */
    @GetMapping
    public void redirectToGoogle(HttpServletResponse response) throws Exception {
        if (!isConfigured()) {
            response.sendRedirect(frontendOrigin + "/login?error=google_not_configured");
            return;
        }
        String redirectUri = buildRedirectUri();
        String url = AUTH_URL
                + "?client_id=" + enc(clientId)
                + "&redirect_uri=" + enc(redirectUri)
                + "&response_type=code"
                + "&scope=" + enc("openid email profile")
                + "&access_type=offline"
                + "&prompt=select_account";
        response.sendRedirect(url);
    }

    /** Google llama aquí con el code. Intercambiamos por JWT y redirigimos al frontend. */
    @GetMapping("/callback")
    public void handleCallback(@RequestParam(required = false) String code,
                                @RequestParam(required = false) String error,
                                HttpServletResponse response) throws Exception {
        if (error != null || code == null) {
            response.sendRedirect(frontendOrigin + "/login?error=google_cancelled");
            return;
        }

        try {
            String idToken = exchangeCodeForIdToken(code);
            String email = extractEmail(idToken);
            String name = extractName(idToken);

            Optional<User> existing = userRepository.findByEmail(email.toLowerCase());
            User user;

            if (existing.isPresent()) {
                user = existing.get();
            } else {
                // Auto-registrar si el correo es @rappi.com, sino rechazar
                if (!email.toLowerCase().endsWith("@rappi.com")) {
                    response.sendRedirect(frontendOrigin + "/login?error=domain_not_allowed");
                    return;
                }
                CreateUserRequest req = new CreateUserRequest();
                req.setFullName(name != null ? name : email.split("@")[0]);
                req.setEmail(email.toLowerCase());
                req.setPassword("google-oauth-" + System.currentTimeMillis());
                req.setRole("FARMER_MASS");
                req.setCountryCode("CO");
                user = userService.createUser(req);
                log.info("Usuario creado via Google OAuth: {}", email);
            }

            String jwt = jwtService.generateToken(user.getEmail(), user.getUserRole().name());
            String userData = URLEncoder.encode(
                    user.getFullName() + "|" + user.getEmail() + "|" + user.getUserRole().name() + "|" + user.getId(),
                    StandardCharsets.UTF_8);

            response.sendRedirect(frontendOrigin + "/oauth-callback?token=" + jwt + "&user=" + userData);

        } catch (Exception e) {
            log.error("Error en Google OAuth callback: {}", e.getMessage());
            response.sendRedirect(frontendOrigin + "/login?error=oauth_failed");
        }
    }

    /** Verifica si las credenciales de Google están configuradas. */
    @GetMapping("/configured")
    public ResponseEntity<Map<String, Boolean>> isConfiguredEndpoint() {
        return ResponseEntity.ok(Map.of("configured", isConfigured()));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private String exchangeCodeForIdToken(String code) throws Exception {
        String redirectUri = buildRedirectUri();
        String body = "code=" + enc(code)
                + "&client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret)
                + "&redirect_uri=" + enc(redirectUri)
                + "&grant_type=authorization_code";

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode json = objectMapper.readTree(res.body());

        if (!json.has("id_token")) {
            throw new Exception("Google no devolvió id_token: " + res.body());
        }
        return json.get("id_token").asText();
    }

    private String extractEmail(String idToken) throws Exception {
        JsonNode claims = decodeJwtPayload(idToken);
        if (!claims.has("email")) throw new Exception("JWT no contiene email");
        return claims.get("email").asText();
    }

    private String extractName(String idToken) {
        try {
            JsonNode claims = decodeJwtPayload(idToken);
            return claims.has("name") ? claims.get("name").asText() : null;
        } catch (Exception e) { return null; }
    }

    private JsonNode decodeJwtPayload(String jwt) throws Exception {
        String[] parts = jwt.split("\\.");
        if (parts.length < 2) throw new Exception("JWT inválido");
        String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        return objectMapper.readTree(payload);
    }

    private boolean isConfigured() {
        return clientId != null && !clientId.isBlank() && !clientId.equals("TU_CLIENT_ID_AQUI")
                && clientSecret != null && !clientSecret.isBlank();
    }

    private String buildRedirectUri() {
        return googleRedirectUri;
    }

    private String enc(String v) throws Exception {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }

    /** Alias del callback de Google Calendar — la URL configurada en Google Cloud Console */
    @org.springframework.web.bind.annotation.GetMapping("/calendar/callback")
    public void calendarCallback(
            @org.springframework.web.bind.annotation.RequestParam String code,
            @org.springframework.web.bind.annotation.RequestParam String state,
            jakarta.servlet.http.HttpServletResponse response) throws Exception {
        calendarController.callback(code, state, response);
    }
}
