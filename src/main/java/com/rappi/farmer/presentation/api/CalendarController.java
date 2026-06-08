package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.GoogleCalendarService;
import com.rappi.farmer.application.services.UserService;
import com.rappi.farmer.infrastructure.security.JwtService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private final GoogleCalendarService calendarService;
    private final UserService userService;
    private final JwtService jwtService;

    @Value("${frontend.url:http://localhost:5173}")
    private String frontendUrl;

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

    /** Google redirige aquí con el código de autorización — redirige al frontend para evitar COOP */
    @GetMapping("/callback")
    public void callback(@RequestParam String code, @RequestParam String state,
                         HttpServletResponse response) throws Exception {
        String status;
        try {
            Long userId = Long.parseLong(state);
            calendarService.handleCallback(code, userId);
            status = "connected";
        } catch (Exception e) {
            log.error("Error en callback de Google Calendar: {}", e.getMessage());
            status = "error";
        }
        // Redirige al frontend (mismo origen que el opener) para que pueda usar localStorage
        response.sendRedirect(frontendUrl + "/calendar-callback?status=" + status);
    }

    /** Estado de conexión del calendar del usuario */
    @GetMapping("/status")
    public ResponseEntity<?> status(@RequestHeader("Authorization") String authHeader) {
        Long userId = resolveUserId(authHeader);
        return ResponseEntity.ok(Map.of("connected", userService.isCalendarConnected(userId)));
    }

    /** Desconectar calendar */
    @DeleteMapping("/disconnect")
    public ResponseEntity<?> disconnect(@RequestHeader("Authorization") String authHeader) {
        Long userId = resolveUserId(authHeader);
        userService.disconnectCalendar(userId);
        return ResponseEntity.ok(Map.of("message", "Google Calendar desconectado"));
    }

    /** Forzar sincronización manual — devuelve detalle de lo que activó */
    @PostMapping("/sync")
    public ResponseEntity<?> sync(@RequestHeader("Authorization") String authHeader) {
        try {
            var result = calendarService.syncHandoffs();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error en sync manual: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    /** HO que no pasaron validación en el último sync */
    @GetMapping("/failed-handoffs")
    public ResponseEntity<?> failedHandoffs(@RequestHeader("Authorization") String authHeader) {
        return ResponseEntity.ok(calendarService.getFailedHandoffs());
    }

    /** Todos los HO en ventana -14/+7 días, diferenciados por exitoso/no exitoso */
    @GetMapping("/handoff-summary")
    public ResponseEntity<?> handoffSummary(@RequestHeader("Authorization") String authHeader) {
        return ResponseEntity.ok(Map.of(
                "meetConectado", calendarService.isMeetApiAccesible(),
                "handoffs", calendarService.getHandoffSummary()
        ));
    }

    private Long resolveUserId(String authHeader) {
        String email = jwtService.extractEmail(authHeader.substring(7));
        return userService.findIdByEmail(email);
    }
}
