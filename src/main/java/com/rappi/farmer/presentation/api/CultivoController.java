package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.CultivoService;
import com.rappi.farmer.domain.enums.FruitCategory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Cultivos: fresa recibida por dia y precios de compra. */
@RestController
@RequestMapping("/api/cultivos")
@PreAuthorize("hasAnyRole('ADMIN','DUENA','ASISTENTE')")
@RequiredArgsConstructor
public class CultivoController {

    private final CultivoService service;

    public record CropRequest(@NotBlank String name) {}
    public record PriceRequest(@NotNull Long cropId, @NotNull FruitCategory category, @NotNull BigDecimal price) {}
    public record IntakeRequest(@NotNull LocalDate date, @NotNull Long cropId, @NotNull FruitCategory category,
                                @NotNull @Min(0) Integer boxes) {}

    @GetMapping("/day")
    public ResponseEntity<?> day(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(service.getDay(date != null ? date : LocalDate.now()));
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody CropRequest r) {
        return ResponseEntity.ok(service.createCrop(r.name()));
    }

    @PutMapping("/prices")
    public ResponseEntity<?> price(@Valid @RequestBody PriceRequest r) {
        service.setPrice(r.cropId(), r.category(), r.price());
        return ResponseEntity.ok(service.getDay(LocalDate.now()));
    }

    @PutMapping("/intake")
    public ResponseEntity<?> intake(@Valid @RequestBody IntakeRequest r) {
        service.setIntake(r.date(), r.cropId(), r.category(), r.boxes());
        return ResponseEntity.ok(service.getDay(r.date()));
    }
}
