package com.rappi.farmer.application.dtos;

import java.util.List;

/** Una fila de la pestaña "soporte" del Google Sheet — un caso/tarea asignado a un agente. */
public record AgmTareaDto(
        int rowNumber,          // número de fila real en el Sheet (1-based), para poder actualizarla
        String storeId,
        String tipoSoporte,
        String explicacion,
        String status,
        String comentarioInterno,
        String comentarioAliado,
        String fechaEscalamiento,
        String areaEscalada,
        String ticket,
        String statusTicket,
        String historial,
        List<String> links,
        String categoria,     // categoría de SLA resuelta desde SlaCatalog (heurística por keywords)
        Integer slaHoras,     // horas totales de SLA para esa categoría
        String fechaLimite    // ISO-8601 (LocalDateTime), null si no hay FECHA_ASIGNACION para calcularlo
) {}
