package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Viajes del dia con sus ingresos (fletes) y gastos. Neto = ingresos - gastos. */
public record TripDayDto(LocalDate date, List<TripDto> trips, BigDecimal income, BigDecimal expense, BigDecimal net,
                         List<PresetDto> presets) {

    public record EntryDto(Long id, String type, String concept, Integer boxes, BigDecimal unitAmount, BigDecimal amount) {}

    public record TripDto(Long id, String driverName, String destination, String notes, List<EntryDto> entries,
                          BigDecimal income, BigDecimal expense, BigDecimal net) {}

    public record PresetDto(Long id, String kind, String concept, BigDecimal unitAmount, boolean perBox) {}
}
