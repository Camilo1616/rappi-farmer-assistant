package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.SalesService;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.exceptions.InsufficientStrawberriesException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SalesController {

    /** Ruta del front donde se crean/asignan cultivos; se devuelve al faltar fresas. */
    static final String CROPS_LINK = "/dashboard/gestiones?tab=cultivos";

    private final SalesService service;

    public record CreateSaleRequest(@NotBlank String customerName, @NotNull @Positive BigDecimal quantityKg) {}
    public record CreateCropRequest(@NotBlank String name, String location) {}
    public record KgRequest(@NotNull @Positive BigDecimal kg) {}
    public record AssignCropRequest(@NotNull Long cropId) {}

    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(Map.of(
                "sales", service.listSales(),
                "bankKg", service.bankQuantity()));
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody CreateSaleRequest req) {
        return ResponseEntity.ok(service.createSale(req.customerName(), req.quantityKg()));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<?> confirm(@PathVariable Long id) {
        return ResponseEntity.ok(service.confirmSale(id));
    }

    @PutMapping("/{id}/crop")
    public ResponseEntity<?> assignCrop(@PathVariable Long id, @Valid @RequestBody AssignCropRequest req) {
        return ResponseEntity.ok(service.assignCrop(id, req.cropId()));
    }

    @PostMapping("/{id}/order")
    public ResponseEntity<?> createOrder(@PathVariable Long id) {
        return ResponseEntity.ok(service.createOrder(id));
    }

    @GetMapping("/crops")
    public ResponseEntity<?> crops() {
        return ResponseEntity.ok(Map.of("crops", service.listCrops(), "bankKg", service.bankQuantity()));
    }

    @PostMapping("/crops")
    public ResponseEntity<?> createCrop(@Valid @RequestBody CreateCropRequest req) {
        return ResponseEntity.ok(service.createCrop(req.name(), req.location()));
    }

    @DeleteMapping("/crops/{id}")
    public ResponseEntity<?> deleteCrop(@PathVariable Long id) {
        service.deleteCrop(id);
        return ResponseEntity.ok(Map.of("message", "ok"));
    }

    @PostMapping("/crops/{id}/harvest")
    public ResponseEntity<?> harvest(@PathVariable Long id, @Valid @RequestBody KgRequest req) {
        return ResponseEntity.ok(service.harvest(id, req.kg()));
    }

    @ExceptionHandler(InsufficientStrawberriesException.class)
    public ResponseEntity<?> noStrawberries(InsufficientStrawberriesException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "code", "NO_STRAWBERRIES",
                "message", e.getMessage(),
                "cropsLink", CROPS_LINK));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<?> business(BusinessException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
