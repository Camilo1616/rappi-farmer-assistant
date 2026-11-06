package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.TripService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Viajes del conductor: ingresos (fletes), gastos y tarifas frecuentes. */
@RestController
@RequestMapping("/api/viajes")
@PreAuthorize("hasAnyRole('ADMIN','DUENA','ASISTENTE')")
@RequiredArgsConstructor
public class TripController {

    private final TripService service;

    public record TripRequest(@NotNull LocalDate date, String driverName, String destination, String notes) {}
    public record EntryRequest(@NotNull LocalDate date, @NotNull Long tripId, @NotBlank String type,
                               @NotBlank String concept, Integer boxes, BigDecimal unitAmount, BigDecimal amount) {}
    public record PresetRequest(@NotBlank String kind, @NotBlank String concept, BigDecimal unitAmount, boolean perBox) {}

    @GetMapping("/day")
    public ResponseEntity<?> day(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(service.getDay(date != null ? date : LocalDate.now()));
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody TripRequest r) {
        service.createTrip(r.date(), r.driverName(), r.destination(), r.notes());
        return ResponseEntity.ok(service.getDay(r.date()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        service.deleteTrip(id);
        return ResponseEntity.ok(service.getDay(date));
    }

    @PostMapping("/entries")
    public ResponseEntity<?> addEntry(@Valid @RequestBody EntryRequest r) {
        service.addEntry(r.tripId(), r.type(), r.concept(), r.boxes(), r.unitAmount(), r.amount());
        return ResponseEntity.ok(service.getDay(r.date()));
    }

    @DeleteMapping("/entries/{id}")
    public ResponseEntity<?> deleteEntry(@PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        service.deleteEntry(id);
        return ResponseEntity.ok(service.getDay(date));
    }

    @PutMapping("/presets")
    public ResponseEntity<?> savePreset(@Valid @RequestBody PresetRequest r,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        service.savePreset(r.kind(), r.concept(), r.unitAmount(), r.perBox());
        return ResponseEntity.ok(service.getDay(date != null ? date : LocalDate.now()));
    }

    @DeleteMapping("/presets/{id}")
    public ResponseEntity<?> deletePreset(@PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        service.deletePreset(id);
        return ResponseEntity.ok(service.getDay(date != null ? date : LocalDate.now()));
    }
}
