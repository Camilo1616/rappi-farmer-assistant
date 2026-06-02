package com.rappi.farmer.application.services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final int CODE_EXPIRY_SECONDS = 600; // 10 minutos

    private final JavaMailSender mailSender;
    private final ConcurrentMap<String, Entry> pending = new ConcurrentHashMap<>();

    /** Genera y envía un código de 6 dígitos al correo indicado. */
    public void sendCode(String email) {
        String code = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        pending.put(email.toLowerCase(),
                new Entry(code, Instant.now().plusSeconds(CODE_EXPIRY_SECONDS)));

        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject("Código de verificación — Rappi Farmer Assistant");
        msg.setText(
                "Hola!\n\n" +
                "Tu código de verificación es:\n\n" +
                "  " + code + "\n\n" +
                "Válido por 10 minutos.\n\n" +
                "Si no solicitaste este código, ignora este mensaje.\n\n" +
                "— Rappi Farmer Assistant");
        mailSender.send(msg);
        log.info("Código de verificación enviado a {}", email);
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
