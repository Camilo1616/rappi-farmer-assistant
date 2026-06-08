package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.GoogleCalendarService;
import com.rappi.farmer.application.services.UserService;
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
    private final UserService userService;
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

    /** Google redirige aquí con el código de autorización (ambas rutas por compatibilidad) */
    @GetMapping("/callback")
    public ResponseEntity<String> callback(@RequestParam String code, @RequestParam String state) {
        String status;
        try {
            Long userId = Long.parseLong(state);
            calendarService.handleCallback(code, userId);
            status = "connected";
        } catch (Exception e) {
            log.error("Error en callback de Google Calendar: {}", e.getMessage());
            status = "error";
        }
        // Página HTML que cierra el popup y notifica a la ventana padre
        String html = """
                <!DOCTYPE html>
                <html>
                <body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc">
                  <div style="text-align:center;padding:32px">
                    <p style="font-size:32px;margin:0">%s</p>
                    <p style="font-size:16px;font-weight:600;color:#0f172a;margin:12px 0 4px">%s</p>
                    <p style="font-size:13px;color:#64748b">Cerrando ventana...</p>
                  </div>
                  <script>
                    window.opener && window.opener.postMessage('%s', '*');
                    setTimeout(() => window.close(), 1500);
                  </script>
                </body>
                </html>
                """.formatted(
                status.equals("connected") ? "✅" : "❌",
                status.equals("connected") ? "Google Calendar conectado" : "Error al conectar",
                status
        );
        return ResponseEntity.ok()
                .header("Content-Type", "text/html; charset=UTF-8")
                .body(html);
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
