package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.dtos.CreateUserRequest;
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

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final JwtService jwtService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            User user = userService.login(request.email(), request.password());
            String token = jwtService.generateToken(user.getEmail(), user.getUserRole().name());
            return ResponseEntity.ok(new AuthResponse(token, user.getEmail(),
                    user.getFullName(), user.getUserRole().name(), user.getId()));
        } catch (BusinessException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody CreateUserRequest request) {
        try {
            User user = userService.createUser(request);
            String token = jwtService.generateToken(user.getEmail(), user.getUserRole().name());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new AuthResponse(token, user.getEmail(),
                            user.getFullName(), user.getUserRole().name(), user.getId()));
        } catch (BusinessException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

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
