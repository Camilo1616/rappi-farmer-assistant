package com.rappi.farmer.application.dtos;

/** Una fila de la pestaña HISTORIAL_ESTADOS — un cambio de estado registrado sobre un caso. */
public record AgmHistorialEntryDto(
        String fechaHora,
        String storeId,
        String agente,
        String status,
        String comentarioInterno,
        String comentarioAliado,
        String ticket,
        String statusTicket
) {}
