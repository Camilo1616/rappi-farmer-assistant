package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Fresa recibida de cada cultivo en un dia, con su costo de compra. */
public record CultivoDayDto(LocalDate date, List<CropDto> crops, int totalBoxes, BigDecimal totalCost) {

    public record IntakeDto(String category, int boxes, BigDecimal unitPrice) {}

    /** prices: precio de compra vigente por categoria; intakes: lo recibido ese dia. */
    public record CropDto(Long id, String name, Map<String, BigDecimal> prices, List<IntakeDto> intakes,
                          int boxes, BigDecimal cost) {}
}
