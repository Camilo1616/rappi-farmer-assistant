package com.rappi.farmer.application.dtos;

public record GuardarAgmGestionRequest(
        int rowNumber,
        String storeId,
        String agente,
        String status,
        String comentarioInterno,
        String comentarioAliado,
        String fechaEscalamiento,
        String ticket,
        String statusTicket,
        String motivoBaja,
        String tipoBlacklist
) {}
