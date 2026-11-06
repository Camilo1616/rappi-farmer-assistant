package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.DispatchService;
import com.rappi.farmer.domain.enums.FruitCategory;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.exceptions.InsufficientStockException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/** API del despacho diario de fresas. Solo la dueña y el administrador. */
@RestController
@RequestMapping("/api/despacho")
@PreAuthorize("hasAnyRole('ADMIN','DUENA')")
@RequiredArgsConstructor
public class DispatchController {

    private final DispatchService service;

    public record HarvestRequest(@NotNull LocalDate date, @NotNull FruitCategory category, @NotNull @Min(0) Integer boxes) {}
    public record LineRequest(@NotNull LocalDate date, @NotNull Long clientId, @NotNull FruitCategory category,
                              @NotNull @Min(0) Integer orderedBoxes, @NotNull @Min(0) Integer deliveredBoxes) {}
    public record PriceRequest(@NotNull FruitCategory category, @NotNull BigDecimal price) {}
    public record SectorRequest(@NotBlank String name) {}
    public record ClientRequest(@NotNull Long sectorId, @NotBlank String name, BigDecimal openingBalance) {}

    @GetMapping("/day")
    public ResponseEntity<?> day(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(service.getDay(date != null ? date : LocalDate.now()));
    }

    @PutMapping("/harvest")
    public ResponseEntity<?> harvest(@Valid @RequestBody HarvestRequest r) {
        service.setHarvest(r.date(), r.category(), r.boxes());
        return ResponseEntity.ok(service.getDay(r.date()));
    }

    @PutMapping("/discard")
    public ResponseEntity<?> discard(@Valid @RequestBody HarvestRequest r) {
        service.setDiscard(r.date(), r.category(), r.boxes());
        return ResponseEntity.ok(service.getDay(r.date()));
    }

    @PutMapping("/line")
    public ResponseEntity<?> line(@Valid @RequestBody LineRequest r) {
        service.setLine(r.date(), r.clientId(), r.category(), r.orderedBoxes(), r.deliveredBoxes());
        return ResponseEntity.ok(service.getDay(r.date()));
    }

    @PutMapping("/prices")
    public ResponseEntity<?> price(@Valid @RequestBody PriceRequest r) {
        service.setPrice(r.category(), r.price());
        return ResponseEntity.ok(Map.of("message", "ok"));
    }

    @PostMapping("/sectors")
    public ResponseEntity<?> sector(@Valid @RequestBody SectorRequest r) {
        return ResponseEntity.ok(service.createSector(r.name()));
    }

    @PostMapping("/clients")
    public ResponseEntity<?> client(@Valid @RequestBody ClientRequest r) {
        return ResponseEntity.ok(service.createClient(r.sectorId(), r.name(), r.openingBalance()));
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<?> noStock(InsufficientStockException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "code", "NO_STOCK", "message", e.getMessage(), "maxAllowed", e.getMaxAllowed()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<?> business(BusinessException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
