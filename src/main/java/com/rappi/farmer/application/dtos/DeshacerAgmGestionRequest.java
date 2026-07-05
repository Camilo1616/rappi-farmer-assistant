package com.rappi.farmer.application.dtos;

public record DeshacerAgmGestionRequest(
        String storeId,
        int rowNumber,
        String agente
) {}
