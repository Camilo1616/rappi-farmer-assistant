package com.rappi.farmer.infrastructure.excel;

import com.rappi.farmer.application.dtos.StoreExcelRowDto;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Lee el archivo Excel de cartera diaria y extrae los datos de cada tienda.
 *
 * Detección de encabezado por nombre (no por posición): resistente a cambios
 * de orden de columnas en el Excel de Rappi.
 *
 * Porcentajes: Excel guarda AVA como decimal (0.38 = 38%). getPercentage()
 * detecta esto y multiplica × 100 para que la BD guarde 38.00.
 */
@Slf4j
@Component
public class ExcelReaderService {

    private static final String COL_STORE_ID       = "COUNTRY STORE ID";
    private static final String COL_BRAND_ID       = "COUNTRY BRAND ID";
    private static final String COL_STORE_NAME     = "STORE NAME";
    private static final String COL_PHONE          = "TELEFONO_PRINCIPAL";
    private static final String COL_BACKUP_PHONE   = "OTROS TELEFONOS";
    private static final String COL_CHANNEL        = "CANAL";
    private static final String COL_ONBOARDING     = "Fecha inicio store";
    private static final String COL_CONNECTION     = "AVA_L4W";
    private static final String COL_CHURN_STATUS   = "Estado Churn AVA";
    private static final String COL_ORDERS_L4W     = "Ordenes L4W Hoy";
    private static final String COL_AGING          = "AGING";
    private static final String COL_AGING_STAGE    = "AGING"; // mismo campo, leído como String
    private static final String COL_AVA_STATUS     = "AVA STATUS";
    private static final String COL_HANDOFF        = "TUVO_HANDOFF";
    private static final String COL_AVA_L7D        = "AVA_L7D";
    private static final String COL_FARMER         = "FARMER";
    private static final String COL_LAST_LOGIN     = "Último Login";
    private static final String COL_AVA_MTD        = "AVA_MTD";
    private static final String COL_GESTIONAR        = "GESTIONAR";
    private static final String COL_UPLOAD_DATE      = "FECHA DE CARGUE";
    private static final String COL_CREDENTIALS      = "Fecha credenciales";
    private static final String COL_LAST_FOLLOW_UP   = "Último FollowUP";
    private static final String COL_FOLLOW_UP_30D    = "FollowUp last 30D";

    // Solo columnas mínimas para validar que sea la plantilla correcta.
    // Las demás columnas son opcionales — quedan null si no están en el Excel.
    private static final List<String> REQUIRED_COLS = List.of(
            "COUNTRY STORE ID", "STORE NAME", "FARMER"
    );

    public List<StoreExcelRowDto> read(File file) throws IOException {
        log.info("Leyendo archivo: {}", file.getName());

        try (Workbook workbook = WorkbookFactory.create(file)) {
            Sheet sheet = workbook.getSheetAt(0);
            int headerRow = findHeaderRowIndex(sheet);

            if (headerRow < 0) {
                throw new IllegalArgumentException(
                        "No se encontró el encabezado del archivo. " +
                        "Asegúrate de usar la plantilla oficial de Rappi Farmer. " +
                        "La primera columna obligatoria es «COUNTRY STORE ID».");
            }

            Map<String, Integer> cols = buildColumnMap(sheet.getRow(headerRow));
            validateRequiredColumns(cols, file.getName());
            List<StoreExcelRowDto> result = new ArrayList<>();

            for (int i = headerRow + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                try {
                    String storeCode = getString(row, cols, COL_STORE_ID);
                    if (storeCode == null || storeCode.isBlank()) continue;

                    result.add(StoreExcelRowDto.builder()
                            .storeCode(storeCode)
                            .brandId(getString(row, cols, COL_BRAND_ID))
                            .storeName(getString(row, cols, COL_STORE_NAME))
                            .phoneNumber(getString(row, cols, COL_PHONE))
                            .backupPhone(getString(row, cols, COL_BACKUP_PHONE))
                            .channel(getString(row, cols, COL_CHANNEL))
                            .onboardingDate(getDate(row, cols, COL_ONBOARDING))
                            .connectionPercentage(getPercentage(row, cols, COL_CONNECTION))
                            .currentStatus(getString(row, cols, COL_CHURN_STATUS))
                            .ordersL4W(getInteger(row, cols, COL_ORDERS_L4W))
                            .aging(getInteger(row, cols, COL_AGING))
                            .agingStage(getString(row, cols, COL_AGING_STAGE))
                            .avaStatus(getString(row, cols, COL_AVA_STATUS))
                            .avaL7d(getPercentage(row, cols, COL_AVA_L7D))
                            .hadHandoff(parseHandoff(getString(row, cols, COL_HANDOFF)))
                            .farmerEmail(getString(row, cols, COL_FARMER))
                            .lastLoginDate(getDate(row, cols, COL_LAST_LOGIN))
                            .avaMtd(getPercentage(row, cols, COL_AVA_MTD))
                            .gestionar(getString(row, cols, COL_GESTIONAR))
                            .uploadDate(getDate(row, cols, COL_UPLOAD_DATE))
                            .credentialsDate(getDate(row, cols, COL_CREDENTIALS))
                            .lastFollowUp(getDate(row, cols, COL_LAST_FOLLOW_UP))
                            .followUpLast30d(getString(row, cols, COL_FOLLOW_UP_30D))
                            .build());

                } catch (Exception e) {
                    log.warn("Error en fila {}: {}", i + 1, e.getMessage());
                }
            }

            log.info("Se leyeron {} tiendas del archivo", result.size());
            return result;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Nombres alternativos para detectar la fila de encabezado
    private static final List<String> STORE_ID_ALIASES = List.of(
            "COUNTRY STORE ID", "STORE ID", "STORE_ID", "ID TIENDA", "ID_TIENDA"
    );

    private int findHeaderRowIndex(Sheet sheet) {
        for (int i = 0; i <= Math.min(10, sheet.getLastRowNum()); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            for (Cell cell : row) {
                String val = cell.toString().trim();
                for (String alias : STORE_ID_ALIASES) {
                    if (alias.equalsIgnoreCase(val)) return i;
                }
            }
        }
        return -1;
    }

    private Map<String, Integer> buildColumnMap(Row headerRow) {
        Map<String, Integer> map = new HashMap<>();
        for (Cell cell : headerRow) {
            String name = cell.toString().trim();
            if (!name.isBlank()) {
                map.put(name, cell.getColumnIndex());
                map.put(name.toUpperCase(), cell.getColumnIndex());
                // Versión sin tildes para tolerancia a diferencias de encoding
                String normalized = normalize(name);
                map.put(normalized, cell.getColumnIndex());
                map.put(normalized.toUpperCase(), cell.getColumnIndex());
            }
        }
        log.info("Columnas detectadas en Excel: {}", map.keySet().stream()
                .filter(k -> !k.equals(k.toUpperCase()) || k.equals(normalize(k).toUpperCase()))
                .sorted().toList());
        return map;
    }

    /** Quita tildes y caracteres especiales para comparación flexible de nombres de columna. */
    private String normalize(String s) {
        return java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }

    private Integer resolveColIndex(Map<String, Integer> cols, String colName) {
        Integer idx = cols.get(colName);
        if (idx != null) return idx;
        idx = cols.get(colName.toUpperCase());
        if (idx != null) return idx;
        idx = cols.get(normalize(colName));
        if (idx != null) return idx;
        idx = cols.get(normalize(colName).toUpperCase());
        if (idx != null) return idx;
        // Para STORE ID intentar aliases alternativos
        if (COL_STORE_ID.equals(colName)) {
            for (String alias : STORE_ID_ALIASES) {
                idx = cols.get(alias);
                if (idx != null) return idx;
                idx = cols.get(alias.toUpperCase());
                if (idx != null) return idx;
            }
        }
        return null;
    }

    private String getString(Row row, Map<String, Integer> cols, String colName) {
        Integer idx = resolveColIndex(cols, colName);
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case BLANK   -> null;
            default      -> cell.toString().trim();
        };
    }

    /**
     * Lee un porcentaje del Excel.
     * Excel guarda "38%" como 0.38 (decimal). Si el valor está en rango 0-1,
     * lo multiplica × 100 para que la BD almacene 38.00.
     * Si ya viene como 38.0 o 87.88, lo deja como está.
     */
    private BigDecimal getPercentage(Row row, Map<String, Integer> cols, String colName) {
        Integer idx = resolveColIndex(cols, colName);
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        try {
            double raw;
            if (cell.getCellType() == CellType.NUMERIC) {
                raw = cell.getNumericCellValue();
            } else {
                String str = cell.toString().trim().replace("%", "").replace(",", ".");
                if (str.isBlank()) return null;
                raw = Double.parseDouble(str);
            }
            // Si está en rango decimal (0-1), convertir a porcentaje (0-100)
            if (raw >= 0 && raw <= 1.0) {
                raw = raw * 100;
            }
            return BigDecimal.valueOf(raw).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            log.debug("No se pudo parsear porcentaje '{}' en columna {}", cell.toString(), colName);
            return null;
        }
    }

    private LocalDate getDate(Row row, Map<String, Integer> cols, String colName) {
        Integer idx = resolveColIndex(cols, colName);
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        try {
            if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                return cell.getLocalDateTimeCellValue().toLocalDate();
            }
            String str = cell.toString().trim();
            if (!str.isBlank()) return LocalDate.parse(str);
        } catch (Exception e) {
            log.debug("No se pudo parsear fecha '{}' en columna {}", cell.toString(), colName);
        }
        return null;
    }

    private Integer getInteger(Row row, Map<String, Integer> cols, String colName) {
        Integer idx = resolveColIndex(cols, colName);
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        try {
            if (cell.getCellType() == CellType.NUMERIC) return (int) cell.getNumericCellValue();
            String str = cell.toString().trim();
            if (!str.isBlank()) return Integer.parseInt(str.split("\\.")[0]);
        } catch (Exception e) {
            log.debug("No se pudo parsear entero '{}' en columna {}", cell.toString(), colName);
        }
        return null;
    }

    private Boolean parseHandoff(String value) {
        if (value == null) return null;
        return value.trim().equalsIgnoreCase("SI") || value.trim().equalsIgnoreCase("SÍ");
    }

    /**
     * Verifica que el archivo contenga todas las columnas requeridas.
     * Si falta alguna, lanza una excepción con el listado exacto de columnas ausentes.
     */
    private boolean colPresent(Map<String, Integer> cols, String name) {
        return cols.containsKey(name)
                || cols.containsKey(name.toUpperCase())
                || cols.containsKey(normalize(name))
                || cols.containsKey(normalize(name).toUpperCase());
    }

    private void validateRequiredColumns(Map<String, Integer> cols, String fileName) {
        List<String> missing = REQUIRED_COLS.stream()
                .filter(req -> {
                    // Para STORE ID aceptar cualquiera de los aliases
                    if ("COUNTRY STORE ID".equals(req)) {
                        return STORE_ID_ALIASES.stream().noneMatch(a -> colPresent(cols, a));
                    }
                    return !colPresent(cols, req);
                })
                .toList();

        if (!missing.isEmpty()) {
            String missingList = String.join(", ", missing);
            throw new IllegalArgumentException(
                    "El archivo «" + fileName + "» no tiene las columnas mínimas requeridas. " +
                    "Faltan: " + missingList + ". " +
                    "Asegúrate de que el archivo tenga al menos: COUNTRY STORE ID, STORE NAME y FARMER.");
        }
    }
}
