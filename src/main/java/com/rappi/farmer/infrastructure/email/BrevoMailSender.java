package com.rappi.farmer.infrastructure.email;

import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.services.MailSender;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/** Envía correos por la API de Brevo con la misma clave que ya usa el sistema (RESEND_API_KEY). */
@Slf4j
@Component
public class BrevoMailSender implements MailSender {

    @Value("${resend.api.key:}")
    private String apiKey;

    @Value("${mail.sender.name:J.Bell}")
    private String senderName;

    @Value("${mail.sender.email:}")
    private String senderEmail;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public void send(String to, String subject, String textBody) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException("El envío de correos no está configurado (falta la clave del servicio de correo)");
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("api-key", apiKey);
            Map<String, Object> body = Map.of(
                    "sender", Map.of("name", senderName, "email", senderEmail),
                    "to", new Object[]{Map.of("email", to)},
                    "subject", subject,
                    "textContent", textBody);
            restTemplate.postForEntity("https://api.brevo.com/v3/smtp/email", new HttpEntity<>(body, headers), String.class);
            // Nunca se registra el contenido: puede incluir una contraseña temporal
            log.info("Correo enviado a {} (asunto: {})", to, subject);
        } catch (Exception e) {
            log.error("Error enviando correo a {}: {}", to, e.getMessage());
            throw new BusinessException("No se pudo enviar el correo. Intenta de nuevo en unos minutos.");
        }
    }
}
