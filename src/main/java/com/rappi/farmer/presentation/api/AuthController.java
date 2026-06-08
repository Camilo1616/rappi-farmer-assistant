package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.dtos.CreateUserRequest;
import com.rappi.farmer.application.services.GoogleCalendarService;
import com.rappi.farmer.application.services.UserService;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final JwtService jwtService;
    private final GoogleCalendarService calendarService;
    private final com.rappi.farmer.application.services.EmailPinService emailPinService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            UserService.LoginResult result = userService.login(request.email(), request.password());
            User user = result.user();
            String token = jwtService.generateToken(user.getEmail(), user.getUserRole().name());
            // Sync calendar en background sin bloquear la respuesta
            CompletableFuture.runAsync(() -> calendarService.syncOnLogin(user, result.calendarSyncDays()));
            return ResponseEntity.ok(new AuthResponse(token, user.getEmail(),
                    user.getFullName(), user.getUserRole().name(), user.getId()));
        } catch (BusinessException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/check-email")
    public ResponseEntity<?> checkEmail(@RequestParam String email) {
        boolean exists = userService.existsByEmail(email);
        return ResponseEntity.ok(Map.of("exists", exists));
    }

    private boolean isRappiEmail(String email) {
        return email != null && email.toLowerCase().endsWith("@rappi.com");
    }

    @PostMapping("/send-pin")
    public ResponseEntity<?> sendPin(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Email requerido"));
        if (!isRappiEmail(email))
            return ResponseEntity.badRequest().body(Map.of("message", "Solo se permiten correos corporativos @rappi.com"));
        try {
            emailPinService.sendPin(email);
            return ResponseEntity.ok(Map.of("message", "PIN enviado a " + email));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (!isRappiEmail(request.email()))
            return ResponseEntity.badRequest().body(Map.of("message", "Solo se permiten correos corporativos @rappi.com"));
        if (!emailPinService.verifyPin(request.email(), request.pin()))
            return ResponseEntity.badRequest().body(Map.of("message", "Código incorrecto o expirado"));
        try {
            CreateUserRequest dto = new CreateUserRequest(
                    request.fullName(), request.email(), request.password(),
                    "FARMER_MASS", request.countryCode(), null, null);
            User user = userService.createUser(dto);
            String token = jwtService.generateToken(user.getEmail(), user.getUserRole().name());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new AuthResponse(token, user.getEmail(),
                            user.getFullName(), user.getUserRole().name(), user.getId()));
        } catch (BusinessException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (!isRappiEmail(email))
            return ResponseEntity.badRequest().body(Map.of("message", "Solo se permiten correos corporativos @rappi.com"));
        if (!userService.existsByEmail(email))
            return ResponseEntity.badRequest().body(Map.of("message", "No existe una cuenta con ese correo"));
        try {
            emailPinService.sendPin(email);
            return ResponseEntity.ok(Map.of("message", "Código enviado a " + email));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String email    = body.get("email");
        String pin      = body.get("pin");
        String newPwd   = body.get("newPassword");
        if (!emailPinService.verifyPin(email, pin))
            return ResponseEntity.badRequest().body(Map.of("message", "Código incorrecto o expirado"));
        if (newPwd == null || newPwd.length() < 6)
            return ResponseEntity.badRequest().body(Map.of("message", "La contraseña debe tener al menos 6 caracteres"));
        try {
            userService.resetPassword(email, newPwd);
            return ResponseEntity.ok(Map.of("message", "Contraseña actualizada"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    public record RegisterRequest(
            String fullName, String email, String password,
            String countryCode, String pin) {}

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password) {}

    public record AuthResponse(
            String token,
            String email,
            String fullName,
            String role,
            Long userId) {}
}
