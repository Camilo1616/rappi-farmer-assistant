package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.dtos.ImportResultDto;
import com.rappi.farmer.application.services.StoreImportService;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final StoreImportService storeImportService;
    private final SessionContext sessionContext;
    private final UserRepository userRepository;

    @PostMapping("/excel")
    public ResponseEntity<?> importExcel(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "El archivo está vacío"));
        }

        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.endsWith(".xlsx") && !filename.endsWith(".xls"))) {
            return ResponseEntity.badRequest().body(Map.of("message", "Solo se aceptan archivos .xlsx o .xls"));
        }

        if (UserRole.ADMIN == sessionContext.getCurrentUserRole()) {
            return ResponseEntity.status(403).body(Map.of("message", "El Administrador no puede importar carteras"));
        }

        File tempFile = null;
        try {
            tempFile = Files.createTempFile("import_", "_" + filename).toFile();
            file.transferTo(tempFile);
            ImportResultDto result = storeImportService.importFromExcel(tempFile);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IOException e) {
            log.error("Error procesando archivo Excel: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "Error al procesar el archivo"));
        } finally {
            if (tempFile != null && tempFile.exists()) {
                tempFile.delete();
            }
        }
    }

    @PostMapping("/clear")
    public ResponseEntity<?> clearData() {
        Long userId = sessionContext.getCurrentUserId();
        UserRole role = sessionContext.getCurrentUserRole();
        log.info("Limpiando cartera — userId:{} role:{}", userId, role);

        List<Long> farmerIds = (UserRole.LIDER == role)
                ? userRepository.findByLiderId(userId).stream().map(u -> u.getId()).toList()
                : List.of();

        try {
            int count = storeImportService.clearStores(userId, role, farmerIds);
            return ResponseEntity.ok(Map.of("message", "Cartera limpiada correctamente", "stores", count));
        } catch (Exception e) {
            log.error("Error limpiando cartera: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("message", "Error: " + e.getMessage()));
        }
    }
}
