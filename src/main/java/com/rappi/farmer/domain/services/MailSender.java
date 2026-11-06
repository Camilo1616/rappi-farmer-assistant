package com.rappi.farmer.domain.services;

/** Puerto de salida para enviar correos de texto. La implementación vive en infrastructure/email. */
public interface MailSender {

    /** @throws com.rappi.farmer.domain.exceptions.BusinessException si el correo no se pudo enviar */
    void send(String to, String subject, String textBody);
}
