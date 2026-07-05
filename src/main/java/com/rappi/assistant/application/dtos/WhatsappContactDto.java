package com.rappi.assistant.application.dtos;

/** Contacto genérico para envío de WhatsApp masivo (nombre + teléfono). */
public record WhatsappContactDto(Long id, String name, String phoneNumber) {}
