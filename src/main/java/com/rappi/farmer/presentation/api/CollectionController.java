package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.CollectionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Cobro presencial: hojas de cobro del conductor, pagos, diferencias, vacias y entrega del efectivo. */
@RestController
@RequestMapping("/api/cobros")
@PreAuthorize("hasAnyRole('ADMIN','DUENA','ASISTENTE')")
@RequiredArgsConstructor
public class CollectionController {

    private final CollectionService service;

    public record RunRequest(@NotNull LocalDate date, String driverName, String destination, Long tripId,
                             List<Long> sectorIds, List<Long> clientIds) {}
    public record ClientRequest(@NotNull Long clientId) {}
    public record CollectRequest(BigDecimal amount, String method, String receivedBy, String note, Integer empties) {}
    public record ResolveRequest(@NotNull String resolution, BigDecimal amount, String note) {}
    public record ReviewRequest(boolean needsReview) {}
    public record HandoverRequest(@NotNull BigDecimal handedAmount, @NotNull String handedTo) {}

    @GetMapping("/day")
    public ResponseEntity<?> day(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(service.getDay(date != null ? date : LocalDate.now()));
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody RunRequest r) {
        return ok(service.createRun(r.date(), r.driverName(), r.destination(), r.tripId(), r.sectorIds(), r.clientIds()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        return ok(service.deleteRun(id));
    }

    @PostMapping("/{id}/clients")
    public ResponseEntity<?> addClient(@PathVariable Long id, @Valid @RequestBody ClientRequest r) {
        return ok(service.addClient(id, r.clientId()));
    }

    @PutMapping("/{id}/handover")
    public ResponseEntity<?> handover(@PathVariable Long id, @Valid @RequestBody HandoverRequest r) {
        return ok(service.handover(id, r.handedAmount(), r.handedTo()));
    }

    @PutMapping("/{id}/reopen")
    public ResponseEntity<?> reopen(@PathVariable Long id) {
        return ok(service.reopen(id));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<?> removeItem(@PathVariable Long itemId) {
        return ok(service.removeItem(itemId));
    }

    @PostMapping("/items/{itemId}/collect")
    public ResponseEntity<?> collect(@PathVariable Long itemId, @RequestBody CollectRequest r) {
        return ok(service.collect(itemId, r.amount(), r.method(), r.receivedBy(), r.note(), r.empties()));
    }

    @PostMapping("/items/{itemId}/resolve")
    public ResponseEntity<?> resolve(@PathVariable Long itemId, @Valid @RequestBody ResolveRequest r) {
        return ok(service.resolve(itemId, r.resolution(), r.amount(), r.note()));
    }

    @PutMapping("/items/{itemId}/review")
    public ResponseEntity<?> review(@PathVariable Long itemId, @RequestBody ReviewRequest r) {
        return ok(service.setReview(itemId, r.needsReview()));
    }

    @DeleteMapping("/payments/{paymentId}")
    public ResponseEntity<?> deletePayment(@PathVariable Long paymentId) {
        return ok(service.deletePayment(paymentId));
    }

    @DeleteMapping("/empties/{id}")
    public ResponseEntity<?> deleteEmpties(@PathVariable Long id) {
        return ok(service.deleteEmpties(id));
    }

    private ResponseEntity<?> ok(LocalDate day) {
        return ResponseEntity.ok(service.getDay(day));
    }
}
