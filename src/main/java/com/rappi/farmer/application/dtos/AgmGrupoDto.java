package com.rappi.farmer.application.dtos;

import java.util.List;

/** Tareas agrupadas por Store — una tarjeta de "store agrupado" en la UI. */
public record AgmGrupoDto(
        String pais,
        String storeId,
        String storeName,
        String telefono,
        List<AgmTareaDto> tareas
) {}
