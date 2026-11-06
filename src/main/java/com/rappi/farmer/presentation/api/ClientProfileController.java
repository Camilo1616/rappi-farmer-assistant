package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.ClientProfileService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Ficha del cliente (CRM): perfil, datos de contacto y notas. */
@RestController
@RequestMapping("/api/despacho/clients/{clientId}")
@PreAuthorize("hasAnyRole('ADMIN','DUENA','ASISTENTE')")
@RequiredArgsConstructor
public class ClientProfileController {

    private static final int DEFAULT_LIMIT = 40;
    private static final int MAX_LIMIT = 400;

    private final ClientProfileService service;

    public record UpdateRequest(@NotBlank String name, @NotNull Long sectorId, String phone, String plaza) {}
    public record NoteRequest(@NotBlank String content) {}

    @GetMapping
    public ResponseEntity<?> profile(@PathVariable Long clientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "" + DEFAULT_LIMIT) int limit) {
        int safe = Math.max(1, Math.min(limit, MAX_LIMIT));
        return ResponseEntity.ok(service.getProfile(clientId, date != null ? date : LocalDate.now(), safe));
    }

    @PutMapping
    public ResponseEntity<?> update(@PathVariable Long clientId, @Valid @RequestBody UpdateRequest r) {
        service.updateClient(clientId, r.name(), r.sectorId(), r.phone(), r.plaza());
        return ResponseEntity.ok(service.getProfile(clientId, LocalDate.now(), DEFAULT_LIMIT));
    }

    @PostMapping("/notes")
    public ResponseEntity<?> addNote(@PathVariable Long clientId, @Valid @RequestBody NoteRequest r) {
        service.addNote(clientId, r.content());
        return ResponseEntity.ok(service.getProfile(clientId, LocalDate.now(), DEFAULT_LIMIT));
    }

    @DeleteMapping("/notes/{noteId}")
    public ResponseEntity<?> deleteNote(@PathVariable Long clientId, @PathVariable Long noteId) {
        service.deleteNote(clientId, noteId);
        return ResponseEntity.ok(service.getProfile(clientId, LocalDate.now(), DEFAULT_LIMIT));
    }
}
