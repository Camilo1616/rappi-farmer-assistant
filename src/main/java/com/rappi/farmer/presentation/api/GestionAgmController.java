package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.dtos.GuardarAgmGestionRequest;
import com.rappi.farmer.application.services.GoogleSheetsService;
import com.rappi.farmer.domain.enums.UserRole;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/agm")
@RequiredArgsConstructor
public class GestionAgmController {

    private final GoogleSheetsService sheetsService;
    private final SessionContext sessionContext;

    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String corsOrigins;

    private String frontendUrl() {
        return corsOrigins.split(",")[0].trim();
    }

    /** ADMIN solicita conectar el Sheet compartido — devuelve la URL de autorización. */
    @GetMapping("/connect")
    public ResponseEntity<?> connect() {
        if (sessionContext.getCurrentUserRole() != UserRole.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Solo un Administrador puede conectar el Sheet"));
        }
        try {
            String authUrl = sheetsService.buildAuthUrl(sessionContext.getCurrentUserEmail());
            return ResponseEntity.ok(Map.of("authUrl", authUrl));
        } catch (Exception e) {
            log.error("Error generando URL de autorización de Sheets: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("message", "Error al conectar Google Sheets"));
        }
    }

    /** Google redirige aquí con el código de autorización. */
    @GetMapping("/callback")
    public void callback(@RequestParam String code, @RequestParam String state,
                          HttpServletResponse response) throws Exception {
        String status;
        try {
            sheetsService.handleCallback(code, state);
            status = "connected";
        } catch (Exception e) {
            log.error("Error en callback de Google Sheets: {}", e.getMessage(), e);
            status = "error";
        }
        response.sendRedirect(frontendUrl() + "/dashboard/agm-ia?sheetsStatus=" + status);
    }

    @GetMapping("/status")
    public ResponseEntity<?> status() {
        return ResponseEntity.ok(Map.of(
                "connected", sheetsService.isConnected(),
                "connectedBy", java.util.Optional.ofNullable(sheetsService.connectedByEmail()).orElse("")
        ));
    }

    @DeleteMapping("/disconnect")
    public ResponseEntity<?> disconnect() {
        if (sessionContext.getCurrentUserRole() != UserRole.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Solo un Administrador puede desconectar el Sheet"));
        }
        sheetsService.disconnect();
        return ResponseEntity.ok(Map.of("message", "Google Sheets desconectado"));
    }

    /** Casos pendientes del agente logueado, agrupados por Store. */
    @GetMapping("/casos")
    public ResponseEntity<?> getCasos(@RequestParam(required = false) String storeId) {
        try {
            String email = sessionContext.getCurrentUserEmail();
            return ResponseEntity.ok(sheetsService.getCasosPorAgente(email, storeId));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error leyendo casos de Sheets: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("message", "Error al leer el Sheet"));
        }
    }

    /** Historial: sin storeId = "mi historial" (últimos N días); con storeId = timeline completo de esa tienda. */
    @GetMapping("/historial")
    public ResponseEntity<?> getHistorial(@RequestParam(required = false) String storeId,
                                           @RequestParam(defaultValue = "7") int days) {
        try {
            String email = sessionContext.getCurrentUserEmail();
            return ResponseEntity.ok(sheetsService.getHistorial(email, storeId, days));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error leyendo historial de Sheets: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("message", "Error al leer el historial"));
        }
    }

    @PostMapping("/gestion")
    public ResponseEntity<?> guardarGestion(@RequestBody GuardarAgmGestionRequest request) {
        try {
            sheetsService.guardarGestion(request);
            return ResponseEntity.ok(Map.of("message", "Gestión guardada"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error guardando gestión en Sheets: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("message", "Error al guardar en el Sheet"));
        }
    }
}
