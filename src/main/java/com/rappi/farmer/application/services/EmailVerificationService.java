package com.rappi.farmer.application.services;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Service
public class EmailVerificationService {

    private static final int CODE_EXPIRY_SECONDS = 600;

    @Value("${resend.api.key:}")
    private String resendApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ConcurrentMap<String, Entry> pending = new ConcurrentHashMap<>();

    /** Genera y envía un código de 6 dígitos al correo indicado. */
    public void sendCode(String email) {
        String code = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        pending.put(email.toLowerCase(),
                new Entry(code, Instant.now().plusSeconds(CODE_EXPIRY_SECONDS)));

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(resendApiKey);

            Map<String, Object> body = Map.of(
                "from", "Rappi Farmer <onboarding@resend.dev>",
                "to", new String[]{email},
                "subject", "Código de verificación — Rappi Farmer Assistant",
                "text", "Hola!\n\nTu código de verificación es:\n\n  " + code +
                        "\n\nVálido por 10 minutos.\n\nSi no solicitaste este código, ignora este mensaje.\n\n— Rappi Farmer Assistant"
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            restTemplate.postForEntity("https://api.resend.com/emails", request, String.class);
            log.info("Código de verificación enviado a {} vía Resend", email);
        } catch (Exception e) {
            log.error("Error enviando código a {}: {}", email, e.getMessage());
            throw new RuntimeException("Error al enviar el código de verificación");
        }
    }

    /** @return true si el código es correcto y no ha expirado */
    public boolean verify(String email, String code) {
        Entry entry = pending.get(email.toLowerCase());
        if (entry == null) return false;
        if (Instant.now().isAfter(entry.expiry())) {
            pending.remove(email.toLowerCase());
            return false;
        }
        if (entry.code().equals(code.trim())) {
            pending.remove(email.toLowerCase());
            return true;
        }
        return false;
    }

    private record Entry(String code, Instant expiry) {}
}
