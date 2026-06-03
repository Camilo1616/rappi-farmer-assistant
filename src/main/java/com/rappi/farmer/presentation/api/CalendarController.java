package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.GoogleCalendarService;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.infrastructure.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private final GoogleCalendarService calendarService;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    /** Farmer solicita conectar su Google Calendar — devuelve la URL de autorización */
    @GetMapping("/connect")
    public ResponseEntity<?> connect(@RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = resolveUserId(authHeader);
            String authUrl = calendarService.buildAuthUrl(userId);
            return ResponseEntity.ok(Map.of("authUrl", authUrl));
        } catch (Exception e) {
            log.error("Error generando URL de autorización: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("message", "Error al conectar Google Calendar"));
        }
    }

    /** Google redirige aquí con el código de autorización */
    @GetMapping("/callback")
    public ResponseEntity<?> callback(@RequestParam String code, @RequestParam String state) {
        try {
            Long userId = Long.parseLong(state);
            calendarService.handleCallback(code, userId);
            // Redirigir al frontend con mensaje de éxito
            return ResponseEntity.status(302)
                    .header("Location", "http://localhost:5173/dashboard?calendar=connected")
                    .build();
        } catch (Exception e) {
            log.error("Error en callback de Google Calendar: {}", e.getMessage());
            return ResponseEntity.status(302)
                    .header("Location", "http://localhost:5173/dashboard?calendar=error")
                    .build();
        }
    }

    /** Estado de conexión del calendar del usuario */
    @GetMapping("/status")
    public ResponseEntity<?> status(@RequestHeader("Authorization") String authHeader) {
        Long userId = resolveUserId(authHeader);
        boolean connected = userRepository.findById(userId)
                .map(u -> u.getCalendarRefreshToken() != null)
                .orElse(false);
        return ResponseEntity.ok(Map.of("connected", connected));
    }

    /** Desconectar calendar */
    @DeleteMapping("/disconnect")
    public ResponseEntity<?> disconnect(@RequestHeader("Authorization") String authHeader) {
        Long userId = resolveUserId(authHeader);
        userRepository.findById(userId).ifPresent(u -> {
            u.setCalendarRefreshToken(null);
            userRepository.save(u);
        });
        return ResponseEntity.ok(Map.of("message", "Google Calendar desconectado"));
    }

    /** Forzar sincronización manual */
    @PostMapping("/sync")
    public ResponseEntity<?> sync(@RequestHeader("Authorization") String authHeader) {
        try {
            calendarService.syncHandoffs();
            return ResponseEntity.ok(Map.of("message", "Sincronización completada"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    private Long resolveUserId(String authHeader) {
        String token = authHeader.substring(7);
        String email = jwtService.extractEmail(token);
        return userRepository.findByEmail(email)
                .map(com.rappi.farmer.domain.entities.User::getId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }
}
