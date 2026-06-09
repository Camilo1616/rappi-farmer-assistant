package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.dtos.ImportResultDto;
import com.rappi.farmer.application.services.StoreImportService;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
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
    private final com.rappi.farmer.domain.repositories.StoreRepository storeRepository;

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

    @GetMapping("/status")
    public ResponseEntity<?> importStatus() {
        Long userId = sessionContext.getCurrentUserId();
        if (userId == null) return ResponseEntity.ok(Map.of("importedToday", false, "required", false));

        // ADMIN y LIDER no están obligados a cargar Excel
        UserRole role = sessionContext.getCurrentUserRole();
        if (role == UserRole.ADMIN || role == UserRole.LIDER) {
            return ResponseEntity.ok(Map.of("importedToday", true, "hasStores", true, "required", false));
        }

        boolean importedToday = userRepository.findById(userId)
                .map(u -> u.getLastImportDate() != null
                        && u.getLastImportDate().equals(java.time.LocalDate.now(java.time.ZoneId.of("America/Bogota"))))
                .orElse(false);

        boolean hasStores = storeRepository.countActiveByUserId(userId) > 0;

        // Se exige cargue diario desde medianoche (00:00) de cada día
        boolean required = !hasStores || !importedToday;

        return ResponseEntity.ok(Map.of(
                "importedToday", importedToday,
                "hasStores", hasStores,
                "required", required
        ));
    }

    @GetMapping("/template")
    public ResponseEntity<byte[]> downloadTemplate() throws IOException {
        String[] headers = {
            "FARMER","CANAL","HUNTER","COUNTRY STORE ID","STORE NAME","COUNTRY BRAND ID",
            "BRAND CATEGORY","AGING","EMAIL_STORE","TELEFONO_PRINCIPAL","OTROS_TELEFONOS",
            "STORE CITY","OPS_ZONE","IS_SEAMLESS","GESTIONAR","TUVO_HANDOFF","PUNTOS_FINALES",
            "MOTIVO","TIPO_EXCEPCION","TIPO_GESTION","RESULTADO_GESTION","Ordenes LW",
            "Ordenes L2W","Ordenes L4W Hoy","Ordenes L4W Ayer","Fecha Activación L4W",
            "Ordenes MTD","Fecha Primera Orden","Última Orden","GMV L4W (USD)",
            "Fecha de cargue","Fecha credenciales","Fecha inicio store",
            "AVA_MTD","AVA_L4W","AVA_L7D","AVA STATUS","Último Login","Estado Churn AVA",
            "TRAFICO","Menú PDF","Link Menú","DeepLink","Catalog Quality","Catalog Products",
            "Catalog Productos sin Imagen","Horarios config.","Logo & Portada","Catalog Estado",
            "Último FollowUP","FollowUp last 30D","Último Follow exitoso",
            "Intentos Follow Totales","Success Follow Totales","Dias Ultimo Follow",
            "MD PRO % WTD","MD % WTD","Revenue MTD","Bookings MTD","Palanca Activa",
            "Descuento Activo","Monto Free ADS USD","Burn Free ADS USD","Top_Performance",
            "Comisión FS","Comisión MD"
        };
        String[] sample = {
            "cristian.guillen@rappi.com","Hunting","Carlos Ruiz","CO_12345","Restaurante Ejemplo","CO_B001",
            "Comida rápida","8","tienda@gmail.com","3001234567","3109876543",
            "Bogotá","Zona Norte","SI","SI","SI","150",
            "Bajo AVA","Técnica","LLAMADA","EFECTIVA","35",
            "38","42","40","2024-01-10",
            "120","2024-01-02","2024-01-20","1250.50",
            "2024-01-21","2024-01-01","2024-01-15",
            "0.75","0.72","0.68","ACTIVE","2024-01-20","Activo",
            "850","SI","https://menu.com","rappi://store/12345","85","40",
            "5","SI","SI","Completo",
            "2024-01-18","4","2024-01-15",
            "12","8","3",
            "0.45","0.38","3500.00","95","SI",
            "10%","50.00","30.00","SI",
            "0.18","0.12"
        };
        String[] descriptions = {
            "Email del farmer *","Hunting/Inside Sales/Self *","Nombre del hunter","ID único tienda *","Nombre tienda *","ID marca *",
            "Categoría marca","Días onboarding *","Email tienda","Teléfono *","Otros teléfonos",
            "Ciudad","Zona ops","SI/NO","SI/NO *","SI/NO *","Puntos finales",
            "Motivo gestión","Tipo excepción","Tipo gestión","Resultado gestión","Pedidos LW",
            "Pedidos L2W","Pedidos L4W *","Pedidos L4W ayer","Fecha activación L4W",
            "Pedidos MTD","Primera orden","Última orden","GMV L4W USD",
            "Fecha cargue *","Fecha credenciales","Fecha inicio *",
            "AVA MTD *","AVA L4W *","AVA L7D *","ACTIVE/INACTIVE *","Último login *","Estado churn *",
            "Tráfico","Menú PDF","Link menú","DeepLink","Calidad catálogo","Productos catálogo",
            "Productos sin imagen","Horarios config","Logo y portada","Estado catálogo",
            "Último follow-up","Follow-ups 30d","Último follow exitoso",
            "Intentos totales","Éxitos totales","Días último follow",
            "MD Pro % WTD","MD % WTD","Revenue MTD","Bookings MTD","Palanca activa",
            "Descuento activo","Monto Free ADS","Burn Free ADS","Top Performance",
            "Comisión FS","Comisión MD"
        };

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            // Hoja 1: Plantilla
            Sheet sheet = wb.createSheet("Cartera");

            // Estilos
            CellStyle headerStyle = wb.createCellStyle();
            Font hFont = wb.createFont();
            hFont.setBold(true);
            hFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(hFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_RED.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle sampleStyle = wb.createCellStyle();
            sampleStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            sampleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle descStyle = wb.createCellStyle();
            Font dFont = wb.createFont();
            dFont.setItalic(true);
            dFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            descStyle.setFont(dFont);

            // Fila encabezado
            Row hRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell c = hRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 6000);
            }

            // Fila ejemplo
            Row sRow = sheet.createRow(1);
            for (int i = 0; i < sample.length; i++) {
                Cell c = sRow.createCell(i);
                c.setCellValue(sample[i]);
                c.setCellStyle(sampleStyle);
            }

            // Fila descripción
            Row dRow = sheet.createRow(2);
            for (int i = 0; i < descriptions.length; i++) {
                Cell c = dRow.createCell(i);
                c.setCellValue(descriptions[i]);
                c.setCellStyle(descStyle);
            }

            // Hoja 2: Guía de valores
            Sheet guide = wb.createSheet("Guía");
            String[][] guideData = {
                {"Campo", "Valores válidos / Formato", "Notas"},
                {"CANAL", "Hunting | Inside Sales | Self", "Distingue el tipo de adquisición"},
                {"TUVO_HANDOFF", "SI | NO", "—"},
                {"IS_SEAMLESS", "SI | NO", "—"},
                {"GESTIONAR", "SI | NO", "—"},
                {"AVA_L4W / AVA_L7D / AVA_MTD", "Decimal 0–1 (ej: 0.72 = 72%)", "También acepta 72 directamente"},
                {"Todas las fechas", "YYYY-MM-DD  ó  formato fecha de Excel", "Ejemplo: 2024-01-15"},
                {"FARMER", "Email corporativo del farmer", "Ejemplo: nombre@rappi.com"},
                {"COUNTRY STORE ID", "ID alfanumérico único", "Ejemplo: CO_12345"},
                {"Comisiones / % (MD PRO, MD, Comisión FS...)", "Decimal 0–1 (ej: 0.18 = 18%)", "—"},
            };
            CellStyle guideHeader = wb.createCellStyle();
            Font gFont = wb.createFont();
            gFont.setBold(true);
            guideHeader.setFont(gFont);
            guideHeader.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            guideHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            for (int r = 0; r < guideData.length; r++) {
                Row row = guide.createRow(r);
                for (int c = 0; c < guideData[r].length; c++) {
                    Cell cell = row.createCell(c);
                    cell.setCellValue(guideData[r][c]);
                    if (r == 0) cell.setCellStyle(guideHeader);
                    guide.setColumnWidth(c, 10000);
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            byte[] bytes = out.toByteArray();

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"plantilla_cartera_rappi.xlsx\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .contentLength(bytes.length)
                    .body(bytes);
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
