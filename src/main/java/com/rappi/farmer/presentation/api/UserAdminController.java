package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.services.UserAdminService;
import com.rappi.farmer.domain.exceptions.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Usuarios y roles del panel de ventas. La contraseña temporal solo viaja por correo, nunca en la respuesta. */
@RestController
@RequestMapping("/api/usuarios")
@PreAuthorize("hasAnyRole('ADMIN','DUENA','ASISTENTE')")
@RequiredArgsConstructor
public class UserAdminController {

    private final UserAdminService service;
    private final SessionContext session;

    public record CreateRequest(@NotBlank String fullName, @NotBlank String email, @NotBlank String role) {}
    public record ActiveRequest(boolean active) {}
    public record RoleRequest(@NotBlank String role) {}

    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(service.list(session.getCurrentUserId()));
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody CreateRequest r) {
        service.create(session.getCurrentUserId(), r.fullName(), r.email(), r.role());
        return ResponseEntity.ok(service.list(session.getCurrentUserId()));
    }

    @PostMapping("/{id}/resend")
    public ResponseEntity<?> resend(@PathVariable Long id) {
        service.resendAccess(session.getCurrentUserId(), id);
        return ResponseEntity.ok(Map.of("message", "Contraseña temporal enviada al correo del usuario"));
    }

    @PutMapping("/{id}/active")
    public ResponseEntity<?> active(@PathVariable Long id, @RequestBody ActiveRequest r) {
        service.setActive(session.getCurrentUserId(), id, r.active());
        return ResponseEntity.ok(service.list(session.getCurrentUserId()));
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<?> role(@PathVariable Long id, @Valid @RequestBody RoleRequest r) {
        service.changeRole(session.getCurrentUserId(), id, r.role());
        return ResponseEntity.ok(service.list(session.getCurrentUserId()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<?> business(BusinessException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
