package com.rappi.farmer.application.dtos;

import java.util.Map;

/** Resumen de gestiones del día para el agente logueado — conteo por status. */
public record AgmResumenDiaDto(
        int totalHoy,
        Map<String, Long> porStatus
) {}
