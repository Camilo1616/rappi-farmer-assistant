package com.rappi.farmer.application.services;

import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.ClientParametersAuthentication;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.SheetsScopes;
import com.google.api.services.sheets.v4.model.AppendValuesResponse;
import com.google.api.services.sheets.v4.model.ValueRange;
import com.rappi.farmer.application.dtos.AgmGrupoDto;
import com.rappi.farmer.application.dtos.AgmHistorialEntryDto;
import com.rappi.farmer.application.dtos.AgmResumenDiaDto;
import com.rappi.farmer.application.dtos.AgmTareaDto;
import com.rappi.farmer.application.dtos.DeshacerAgmGestionRequest;
import com.rappi.farmer.application.dtos.GuardarAgmFeedbackRequest;
import com.rappi.farmer.application.dtos.GuardarAgmGestionRequest;
import com.rappi.farmer.infrastructure.persistence.entity.GoogleSheetsCredentialEntity;
import com.rappi.farmer.infrastructure.persistence.repository.GoogleSheetsCredentialJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Integración con el Google Sheet "Gestión AGM-IA" (LINA). Una sola cuenta (ADMIN) autoriza
 * el acceso una vez; todos los agentes leen/escriben a través de ese mismo token guardado.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GoogleSheetsService {

    private static final GsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final Long SINGLETON_ID = 1L;

    private static final String TAB_SOPORTE          = "soporte";
    private static final String TAB_HISTORIAL_ESTADOS = "HISTORIAL_ESTADOS";
    private static final String TAB_BACKLIST         = "BACKLIST";
    private static final String TAB_FEEDBACK_IA      = "FEEDBACK_IA";

    @Value("${google.sheets.client-id}")
    private String clientId;

    @Value("${google.sheets.client-secret}")
    private String clientSecret;

    @Value("${google.sheets.redirect-uri}")
    private String redirectUri;

    @Value("${google.sheets.spreadsheet-id}")
    private String spreadsheetId;

    private final GoogleSheetsCredentialJpaRepository credentialRepository;

    // Cachea el cliente autenticado — evita re-negociar un access token con Google en cada llamada.
    private volatile Sheets cachedSheets;
    private volatile String cachedRefreshToken;

    // Cachea el contenido de cada pestaña por unos segundos — evita releer el sheet completo
    // varias veces cuando la UI dispara varias peticiones seguidas (resumen, casos, historial...).
    private static final long TAB_CACHE_TTL_MS = 15_000;
    private final Map<String, CachedTab> tabCache = new java.util.concurrent.ConcurrentHashMap<>();

    private record CachedTab(List<List<Object>> rows, long fetchedAt) {}

    // ── OAuth ─────────────────────────────────────────────────────────────────

    public boolean isConnected() {
        return credentialRepository.findById(SINGLETON_ID).isPresent();
    }

    public String connectedByEmail() {
        return credentialRepository.findById(SINGLETON_ID)
                .map(GoogleSheetsCredentialEntity::getConnectedByEmail).orElse(null);
    }

    public String buildAuthUrl(String adminEmail) throws GeneralSecurityException, IOException {
        return buildFlow().newAuthorizationUrl()
                .setRedirectUri(redirectUri)
                .setState(adminEmail)
                .set("access_type", "offline")
                .set("prompt", "select_account consent")
                .set("login_hint", adminEmail)
                .build();
    }

    public void handleCallback(String code, String adminEmail) throws GeneralSecurityException, IOException {
        GoogleTokenResponse tokenResponse = buildFlow().newTokenRequest(code)
                .setRedirectUri(redirectUri).execute();
        String refreshToken = tokenResponse.getRefreshToken();
        if (refreshToken == null) {
            log.warn("No se recibió refresh_token al conectar Google Sheets (adminEmail={})", adminEmail);
            return;
        }
        GoogleSheetsCredentialEntity entity = credentialRepository.findById(SINGLETON_ID)
                .orElseGet(() -> {
                    GoogleSheetsCredentialEntity e = new GoogleSheetsCredentialEntity();
                    e.setId(SINGLETON_ID);
                    return e;
                });
        entity.setRefreshToken(refreshToken);
        entity.setConnectedByEmail(adminEmail);
        entity.setConnectedAt(LocalDateTime.now());
        credentialRepository.save(entity);
        log.info("Google Sheets conectado por {}", adminEmail);
    }

    public void disconnect() {
        credentialRepository.deleteById(SINGLETON_ID);
        cachedSheets = null;
        cachedRefreshToken = null;
        tabCache.clear();
    }

    private GoogleAuthorizationCodeFlow buildFlow() throws GeneralSecurityException, IOException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
        GoogleClientSecrets secrets = new GoogleClientSecrets()
                .setWeb(new GoogleClientSecrets.Details()
                        .setClientId(clientId)
                        .setClientSecret(clientSecret));
        return new GoogleAuthorizationCodeFlow.Builder(transport, JSON_FACTORY, secrets,
                List.of(SheetsScopes.SPREADSHEETS))
                .setAccessType("offline")
                .build();
    }

    private Credential buildCredential(String refreshToken) throws GeneralSecurityException, IOException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
        return new Credential.Builder(BearerToken.authorizationHeaderAccessMethod())
                .setTransport(transport)
                .setJsonFactory(JSON_FACTORY)
                .setTokenServerUrl(new com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/token"))
                .setClientAuthentication(new ClientParametersAuthentication(clientId, clientSecret))
                .build()
                .setRefreshToken(refreshToken);
    }

    private synchronized Sheets sheetsClient() throws GeneralSecurityException, IOException {
        GoogleSheetsCredentialEntity cred = credentialRepository.findById(SINGLETON_ID)
                .orElseThrow(() -> new IllegalStateException("Google Sheets no está conectado — un Administrador debe conectarlo primero"));

        // Reusa el cliente ya autenticado — su Credential interno cachea y renueva el access token
        // solo cuando expira, en vez de pedir uno nuevo en cada request.
        if (cachedSheets != null && cred.getRefreshToken().equals(cachedRefreshToken)) {
            return cachedSheets;
        }

        Credential credential = buildCredential(cred.getRefreshToken());
        Sheets sheets = new Sheets.Builder(GoogleNetHttpTransport.newTrustedTransport(), JSON_FACTORY, credential)
                .setApplicationName("Rappi Assistant — Gestión AGM-IA")
                .build();
        cachedSheets = sheets;
        cachedRefreshToken = cred.getRefreshToken();
        return sheets;
    }

    /** Lee una pestaña completa, sirviendo de caché si se pidió hace menos de {@link #TAB_CACHE_TTL_MS}. */
    private List<List<Object>> readTab(Sheets sheets, String tabName) throws IOException {
        CachedTab cached = tabCache.get(tabName);
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt() < TAB_CACHE_TTL_MS) {
            return cached.rows();
        }
        ValueRange range = getWithRetry(sheets, tabName);
        List<List<Object>> rows = range.getValues() != null ? range.getValues() : List.of();
        tabCache.put(tabName, new CachedTab(rows, System.currentTimeMillis()));
        return rows;
    }

    /**
     * Google a veces responde 503 "Authentication backend unavailable" — un error transitorio de su
     * lado, no del token ni de la hoja. Reintenta un par de veces con backoff corto antes de rendirse.
     */
    private ValueRange getWithRetry(Sheets sheets, String tabName) throws IOException {
        int intentos = 0;
        while (true) {
            try {
                return sheets.spreadsheets().values().get(spreadsheetId, tabName).execute();
            } catch (com.google.api.client.googleapis.json.GoogleJsonResponseException e) {
                intentos++;
                boolean transitorio = e.getStatusCode() >= 500;
                if (!transitorio || intentos >= 3) throw e;
                log.warn("Google Sheets respondió {} leyendo '{}' (intento {}/3) — reintentando...",
                        e.getStatusCode(), tabName, intentos);
                try { Thread.sleep(400L * intentos); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw e;
                }
            }
        }
    }

    private void invalidateTab(String tabName) {
        tabCache.remove(tabName);
    }

    // ── Lectura ───────────────────────────────────────────────────────────────

    /** Devuelve los casos pendientes/asignados a un agente, agrupados por Store. */
    public List<AgmGrupoDto> getCasosPorAgente(String email, String storeFiltro) throws Exception {
        return getCasosInterno(email, storeFiltro);
    }

    /** Fila pendiente cruda del sheet, para el job de sync (necesita el agente asignado por fila). */
    public record FilaPendiente(String storeId, int rowNumber, String agenteAsignado) {}

    /** Devuelve todas las filas pendientes del sheet (cualquier agente) — usado por el job de sync. */
    public List<FilaPendiente> getFilasPendientes() throws Exception {
        Sheets sheets = sheetsClient();
        List<List<Object>> rows = readTab(sheets, TAB_SOPORTE);
        if (rows.isEmpty()) return List.of();

        Map<String, Integer> col = headerIndex(rows.get(0));
        Map<String, LocalDateTime> ultimoToque = ultimoToquePorStore(sheets);
        LocalDate hoy = LocalDate.now();

        List<FilaPendiente> resultado = new ArrayList<>();
        for (int i = 1; i < rows.size(); i++) {
            List<Object> row = rows.get(i);
            String storeId = val(row, col, "STORE_ID");
            if (storeId.isBlank()) continue;

            String status = val(row, col, "STATUS");
            LocalDateTime ultimo = ultimoToque.get(storeId.trim().toLowerCase());
            boolean tocadaHoy = ultimo != null && ultimo.toLocalDate().equals(hoy);

            boolean yaGestionada = esEstadoFinal(status)
                    || (!esEsperandoRespuesta(status)
                        && (!val(row, col, "COMENTARIO INTERNO").isBlank()
                            || !val(row, col, "COMENTARIO PARA EL ALIADO").isBlank()))
                    || (esEsperandoRespuesta(status) && tocadaHoy);
            if (yaGestionada) continue;

            resultado.add(new FilaPendiente(storeId, i + 1, val(row, col, "AGENTE_ASIGNADO")));
        }
        return resultado;
    }

    private List<AgmGrupoDto> getCasosInterno(String email, String storeFiltro) throws Exception {
        Sheets sheets = sheetsClient();
        List<List<Object>> rows = readTab(sheets, TAB_SOPORTE);
        if (rows.isEmpty()) return List.of();

        Map<String, Integer> col = headerIndex(rows.get(0));
        boolean filtrarPorAgente = email != null && !email.isBlank();
        String emailNorm = email == null ? "" : email.trim().toLowerCase();
        String storeNorm = storeFiltro == null ? "" : storeFiltro.trim().toLowerCase();

        // "Esperando Respuesta" se deja visible para poder hacerle seguimiento, pero si ya se tocó
        // hoy no debe reaparecer el mismo día — reaparece mañana si sigue sin resolverse.
        Map<String, LocalDateTime> ultimoToque = ultimoToquePorStore(sheets);
        LocalDate hoy = LocalDate.now();

        // Mapa temporal de storeId -> lista de tareas + metadata, preservando orden de aparición
        LinkedHashMap<String, List<AgmTareaDto>> tareasPorStore = new LinkedHashMap<>();
        Map<String, String[]> metaPorStore = new LinkedHashMap<>(); // storeId -> [pais, storeName, telefono]
        Map<String, String> fechaAsignacionPorStore = new LinkedHashMap<>();

        for (int i = 1; i < rows.size(); i++) {
            List<Object> row = rows.get(i);
            String agenteAsignado = val(row, col, "AGENTE_ASIGNADO");
            if (filtrarPorAgente && !emailNorm.equals(agenteAsignado.trim().toLowerCase())) continue;

            String storeId = val(row, col, "STORE_ID");
            if (storeId.isBlank()) continue;
            if (!storeNorm.isBlank() && !storeId.toLowerCase().contains(storeNorm)) continue;

            String status = val(row, col, "STATUS");
            LocalDateTime ultimo = ultimoToque.get(storeId.trim().toLowerCase());
            boolean tocadaHoy = ultimo != null && ultimo.toLocalDate().equals(hoy);

            // Ya resuelto (o ya diligenciado por otro lado sin actualizar el status) — no debe
            // seguir apareciendo en la cola de pendientes. "Esperando Respuesta" es la excepción
            // que sí se deja ver para seguimiento, salvo que ya se haya tocado hoy mismo.
            boolean yaGestionada = esEstadoFinal(status)
                    || (!esEsperandoRespuesta(status)
                        && (!val(row, col, "COMENTARIO INTERNO").isBlank()
                            || !val(row, col, "COMENTARIO PARA EL ALIADO").isBlank()))
                    || (esEsperandoRespuesta(status) && tocadaHoy);
            if (yaGestionada) continue;

            List<String> links = new ArrayList<>();
            for (String linkCol : List.of("LINK_1", "LINK_2", "LINK_3", "LINK_4", "LINK_5")) {
                String l = val(row, col, linkCol);
                if (!l.isBlank()) links.add(l);
            }

            String tipoSoporte = val(row, col, "TIPO_SOPORTE");
            String explicacion = val(row, col, "EXPLICACION");
            SlaCatalog.SlaInfo sla = SlaCatalog.resolve(tipoSoporte, explicacion);
            LocalDateTime fechaBase = parseFechaHoraCompleta(val(row, col, "FECHA_ASIGNACION"));
            String fechaLimite = fechaBase == null ? null
                    : fechaBase.plusHours(sla.slaHoras()).toString();

            AgmTareaDto tarea = new AgmTareaDto(
                    i + 1, // rowNumber 1-based (i=0 es la fila 1 de encabezados, así que fila real = i+1)
                    storeId,
                    tipoSoporte,
                    explicacion,
                    val(row, col, "STATUS"),
                    val(row, col, "COMENTARIO INTERNO"),
                    val(row, col, "COMENTARIO PARA EL ALIADO"),
                    val(row, col, "FECHA ESCALAMIENTO"),
                    val(row, col, "AREA ESCALADA"),
                    val(row, col, "TICKET"),
                    val(row, col, "STATUS TICKET"),
                    val(row, col, "HISTORIAL_CONVERSACIÓN").isBlank()
                            ? val(row, col, "HISTORIAL_CONVERSACION") : val(row, col, "HISTORIAL_CONVERSACIÓN"),
                    links,
                    sla.categoria(),
                    sla.slaHoras(),
                    fechaLimite
            );

            tareasPorStore.computeIfAbsent(storeId, k -> new ArrayList<>()).add(tarea);
            metaPorStore.putIfAbsent(storeId, new String[]{
                    val(row, col, "PAIS").isBlank() ? val(row, col, "PAÍS") : val(row, col, "PAIS"),
                    val(row, col, "STORE_NAME"),
                    val(row, col, "TELEFONO").isBlank() ? val(row, col, "TELÉFONO") : val(row, col, "TELEFONO"),
            });
            fechaAsignacionPorStore.putIfAbsent(storeId, val(row, col, "FECHA_ASIGNACION"));
        }

        List<AgmGrupoDto> resultado = new ArrayList<>();
        for (var entry : tareasPorStore.entrySet()) {
            String storeId = entry.getKey();
            String[] meta = metaPorStore.getOrDefault(storeId, new String[]{"", "", ""});
            LocalDateTime ultimo = ultimoToque.get(storeId.trim().toLowerCase());
            LocalDate referencia = ultimo != null ? ultimo.toLocalDate()
                    : parseFechaFlexible(fechaAsignacionPorStore.get(storeId));
            Long diasSinTocar = referencia == null ? null
                    : java.time.temporal.ChronoUnit.DAYS.between(referencia, LocalDate.now());
            resultado.add(new AgmGrupoDto(meta[0], storeId, meta[1], meta[2], entry.getValue(), diasSinTocar,
                    fechaAsignacionPorStore.get(storeId)));
        }
        return resultado;
    }

    /**
     * Intenta parsear un FECHA_HORA de HISTORIAL_ESTADOS en varios formatos; null si no se pudo.
     * Cubre tanto "yyyy-MM-dd HH:mm:ss" (formato con el que se escribe hoy) como variantes tipo
     * "d/M/yyyy H:mm:ss" que quedaron en filas antiguas por un bug de auto-formato de Google Sheets.
     */
    private static LocalDate parseFechaHoraFlexible(String value) {
        LocalDateTime completa = parseFechaHoraCompleta(value);
        if (completa != null) return completa.toLocalDate();
        return parseFechaFlexible(value);
    }

    /** Intenta parsear una fecha en varios formatos comunes del Sheet; null si no se pudo. */
    private static LocalDate parseFechaFlexible(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        List<DateTimeFormatter> formatos = List.of(
                DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                DateTimeFormatter.ofPattern("d/M/yyyy"),
                DateTimeFormatter.ofPattern("MM/dd/yyyy")
        );
        for (DateTimeFormatter f : formatos) {
            try { return LocalDate.parse(v, f); } catch (Exception ignored) { }
        }
        return null;
    }

    /** Último FECHA_HORA registrado en HISTORIAL_ESTADOS por cada Store_ID (clave normalizada a minúsculas). */
    private Map<String, LocalDateTime> ultimoToquePorStore(Sheets sheets) throws IOException {
        return toquesPorStore(sheets, false);
    }

    private Map<String, LocalDateTime> toquesPorStore(Sheets sheets, boolean primero) throws IOException {
        List<List<Object>> rows = readTab(sheets, TAB_HISTORIAL_ESTADOS);
        Map<String, LocalDateTime> result = new HashMap<>();
        if (rows.isEmpty()) return result;

        Map<String, Integer> col = headerIndex(rows.get(0));
        for (int i = 1; i < rows.size(); i++) {
            List<Object> row = rows.get(i);
            String storeId = val(row, col, "STORE_ID").trim().toLowerCase();
            if (storeId.isBlank()) continue;
            LocalDateTime fecha = parseFechaHoraCompleta(val(row, col, "FECHA_HORA"));
            if (fecha == null) continue;
            result.merge(storeId, fecha, (a, b) -> (primero ? a.isBefore(b) : a.isAfter(b)) ? a : b);
        }
        return result;
    }

    private static final List<DateTimeFormatter> FORMATOS_FECHA_HORA = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd H:mm:ss"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("d/M/yyyy H:mm:ss"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm:ss")
    );

    /** Igual que {@link #parseFechaHoraFlexible} pero conservando la hora, no solo la fecha. */
    private static LocalDateTime parseFechaHoraCompleta(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        for (DateTimeFormatter f : FORMATOS_FECHA_HORA) {
            try { return LocalDateTime.parse(v, f); } catch (Exception ignored) { }
        }
        return null;
    }

    /**
     * Historial de cambios de estado. Si {@code storeId} viene, muestra el timeline completo de esa
     * tienda (cualquier agente), sin filtro de fecha. Si no, muestra "mi historial": solo los cambios
     * hechos por {@code email}, filtrados por rango de fecha [{@code desde}, {@code hasta}] inclusive
     * (cualquiera puede venir null para dejar ese extremo abierto). Más reciente primero.
     */
    public List<AgmHistorialEntryDto> getHistorial(String email, String storeId, LocalDate desde, LocalDate hasta) throws Exception {
        Sheets sheets = sheetsClient();
        List<List<Object>> rows = readTab(sheets, TAB_HISTORIAL_ESTADOS);
        if (rows.isEmpty()) return List.of();

        Map<String, Integer> col = headerIndex(rows.get(0));
        boolean porStore = storeId != null && !storeId.isBlank();
        String emailNorm = email == null ? "" : email.trim().toLowerCase();
        String storeNorm = porStore ? storeId.trim().toLowerCase() : "";

        List<AgmHistorialEntryDto> resultado = new ArrayList<>();
        for (int i = 1; i < rows.size(); i++) {
            List<Object> row = rows.get(i);
            String rowStoreId = val(row, col, "STORE_ID");
            String rowAgente = val(row, col, "AGENTE");

            if (porStore) {
                if (!rowStoreId.trim().toLowerCase().equals(storeNorm)) continue;
            } else {
                if (!emailNorm.equals(rowAgente.trim().toLowerCase())) continue;
            }

            String fechaHora = val(row, col, "FECHA_HORA");
            if (!porStore && (desde != null || hasta != null)) {
                LocalDate fecha = parseFechaHoraFlexible(fechaHora);
                // Si no se pudo interpretar la fecha, se excluye en vez de incluirla "a ciegas":
                // de lo contrario una fila con formato corrupto aparecería en cualquier rango consultado.
                if (fecha == null) continue;
                if (desde != null && fecha.isBefore(desde)) continue;
                if (hasta != null && fecha.isAfter(hasta)) continue;
            }

            resultado.add(new AgmHistorialEntryDto(
                    fechaHora,
                    rowStoreId,
                    rowAgente,
                    val(row, col, "STATUS"),
                    val(row, col, "COMENTARIO_INTERNO"),
                    val(row, col, "COMENTARIO_ALIADO"),
                    val(row, col, "TICKET"),
                    val(row, col, "STATUS_TICKET")
            ));
        }
        Collections.reverse(resultado);
        return resultado;
    }

    /** Resumen del día: cuántos cambios hizo el agente hoy, agrupados por status resultante. */
    public AgmResumenDiaDto getResumenHoy(String email) throws Exception {
        LocalDate hoy = LocalDate.now();
        List<AgmHistorialEntryDto> historialHoy = getHistorial(email, null, hoy, hoy).stream()
                .filter(h -> h.fechaHora() != null && h.fechaHora().startsWith(hoy.toString()))
                .toList();
        Map<String, Long> porStatus = historialHoy.stream()
                .collect(Collectors.groupingBy(
                        h -> h.status() == null || h.status().isBlank() ? "Sin status" : h.status(),
                        LinkedHashMap::new, Collectors.counting()));
        return new AgmResumenDiaDto(historialHoy.size(), porStatus);
    }

    // ── Escritura ─────────────────────────────────────────────────────────────

    public void guardarGestion(GuardarAgmGestionRequest req) throws Exception {
        Sheets sheets = sheetsClient();
        List<List<Object>> soporteRows = readTab(sheets, TAB_SOPORTE);
        Map<String, Integer> col = headerIndex(soporteRows.isEmpty() ? List.of() : soporteRows.get(0));

        List<ValueRange> updates = new ArrayList<>();
        putUpdate(updates, col, "STATUS", req.rowNumber(), req.status());
        putUpdate(updates, col, "COMENTARIO INTERNO", req.rowNumber(), req.comentarioInterno());
        putUpdate(updates, col, "COMENTARIO PARA EL ALIADO", req.rowNumber(), req.comentarioAliado());
        putUpdate(updates, col, "FECHA ESCALAMIENTO", req.rowNumber(), req.fechaEscalamiento());
        putUpdate(updates, col, "TICKET", req.rowNumber(), req.ticket());
        putUpdate(updates, col, "STATUS TICKET", req.rowNumber(), req.statusTicket());

        boolean esFinal = esEstadoFinal(req.status());
        if (esFinal) {
            putUpdate(updates, col, "FECHA SOLUCION", req.rowNumber(),
                    LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE));
        }

        if (!updates.isEmpty()) {
            com.google.api.services.sheets.v4.model.BatchUpdateValuesRequest batch =
                    new com.google.api.services.sheets.v4.model.BatchUpdateValuesRequest()
                            .setValueInputOption("USER_ENTERED")
                            .setData(updates);
            sheets.spreadsheets().values().batchUpdate(spreadsheetId, batch).execute();
        }

        appendHistorial(sheets, req);
        invalidateTab(TAB_SOPORTE);
        invalidateTab(TAB_HISTORIAL_ESTADOS);

        if ("Baja".equalsIgnoreCase(req.status())) {
            appendBacklist(sheets, req);
        }
    }

    private void putUpdate(List<ValueRange> updates, Map<String, Integer> col, String header, int rowNumber, String value) {
        if (value == null) return;
        Integer idx = col.get(header.toUpperCase());
        if (idx == null) return;
        String a1 = TAB_SOPORTE + "!" + colLetter(idx) + rowNumber;
        updates.add(new ValueRange().setRange(a1).setValues(List.of(List.of(value))));
    }

    private void appendHistorial(Sheets sheets, GuardarAgmGestionRequest req) throws IOException {
        List<Object> row = List.of(
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")),
                nullToEmpty(req.storeId()),
                nullToEmpty(req.agente()),
                nullToEmpty(req.status()),
                nullToEmpty(req.comentarioInterno()),
                nullToEmpty(req.comentarioAliado()),
                nullToEmpty(req.ticket()),
                nullToEmpty(req.statusTicket()),
                "",
                ""
        );
        ValueRange body = new ValueRange().setValues(List.of(row));
        sheets.spreadsheets().values()
                // RAW: guarda "yyyy-MM-dd HH:mm:ss" tal cual, sin dejar que Sheets la auto-detecte como
                // fecha y la reformatee según el locale (eso rompía el filtro por rango en el historial).
                .append(spreadsheetId, TAB_HISTORIAL_ESTADOS, body)
                .setValueInputOption("RAW")
                .execute();
    }

    private void appendBacklist(Sheets sheets, GuardarAgmGestionRequest req) throws IOException {
        List<Object> row = List.of(
                nullToEmpty(req.storeId()),
                nullToEmpty(req.status()),
                nullToEmpty(req.motivoBaja()),
                LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE),
                nullToEmpty(req.agente()),
                nullToEmpty(req.tipoBlacklist())
        );
        ValueRange body = new ValueRange().setValues(List.of(row));
        sheets.spreadsheets().values()
                .append(spreadsheetId, TAB_BACKLIST, body)
                .setValueInputOption("USER_ENTERED")
                .execute();
    }

    /**
     * Revierte la fila de "soporte" al estado anterior al último cambio registrado en HISTORIAL_ESTADOS
     * para ese Store. Requiere al menos 2 entradas de historial para ese store (la actual + una previa).
     */
    public void deshacerUltimoCambio(DeshacerAgmGestionRequest req) throws Exception {
        Sheets sheets = sheetsClient();
        List<AgmHistorialEntryDto> historial = getHistorial(null, req.storeId(), null, null); // más reciente primero
        if (historial.size() < 2) {
            throw new IllegalStateException("No hay un estado anterior registrado para deshacer en esta tienda");
        }
        AgmHistorialEntryDto anterior = historial.get(1);

        List<List<Object>> soporteRows = readTab(sheets, TAB_SOPORTE);
        Map<String, Integer> col = headerIndex(soporteRows.isEmpty() ? List.of() : soporteRows.get(0));

        List<ValueRange> updates = new ArrayList<>();
        putUpdate(updates, col, "STATUS", req.rowNumber(), anterior.status());
        putUpdate(updates, col, "COMENTARIO INTERNO", req.rowNumber(), anterior.comentarioInterno());
        putUpdate(updates, col, "COMENTARIO PARA EL ALIADO", req.rowNumber(), anterior.comentarioAliado());
        putUpdate(updates, col, "TICKET", req.rowNumber(), anterior.ticket());
        putUpdate(updates, col, "STATUS TICKET", req.rowNumber(), anterior.statusTicket());

        if (!updates.isEmpty()) {
            com.google.api.services.sheets.v4.model.BatchUpdateValuesRequest batch =
                    new com.google.api.services.sheets.v4.model.BatchUpdateValuesRequest()
                            .setValueInputOption("USER_ENTERED")
                            .setData(updates);
            sheets.spreadsheets().values().batchUpdate(spreadsheetId, batch).execute();
        }

        List<Object> row = List.of(
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")),
                nullToEmpty(req.storeId()),
                nullToEmpty(req.agente()),
                "[DESHECHO] " + nullToEmpty(anterior.status()),
                nullToEmpty(anterior.comentarioInterno()),
                nullToEmpty(anterior.comentarioAliado()),
                nullToEmpty(anterior.ticket()),
                nullToEmpty(anterior.statusTicket()),
                "",
                ""
        );
        ValueRange body = new ValueRange().setValues(List.of(row));
        sheets.spreadsheets().values()
                .append(spreadsheetId, TAB_HISTORIAL_ESTADOS, body)
                .setValueInputOption("RAW")
                .execute();

        invalidateTab(TAB_SOPORTE);
        invalidateTab(TAB_HISTORIAL_ESTADOS);
    }

    /**
     * Registra un reporte de "Feedback IA" (la IA respondió mal). Formato de columnas inferido de datos
     * existentes en la hoja (sin encabezados) — ajustar si no calza exactamente con lo esperado.
     */
    public void guardarFeedbackIA(String agenteEmail, GuardarAgmFeedbackRequest req) throws Exception {
        Sheets sheets = sheetsClient();
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        List<Object> row = List.of(
                "",
                "",
                UUID.randomUUID().toString(),
                agenteEmail + " (" + timestamp + "): " + nullToEmpty(req.mensajeErroneo()),
                nullToEmpty(req.solucion())
        );
        ValueRange body = new ValueRange().setValues(List.of(row));
        sheets.spreadsheets().values()
                .append(spreadsheetId, TAB_FEEDBACK_IA, body)
                .setValueInputOption("USER_ENTERED")
                .execute();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** "Esperando Respuesta" no es un estado final: la fila ya tiene comentario diligenciado pero
     *  debe seguir apareciendo en la cola para poder hacerle seguimiento al aliado. */
    private static boolean esEsperandoRespuesta(String status) {
        return status != null && "esperando respuesta".equals(status.trim().toLowerCase());
    }

    private static boolean esEstadoFinal(String status) {
        if (status == null) return false;
        String s = status.trim().toLowerCase();
        return Set.of("imposible contacto", "confirmado", "baja", "asignada a otra área",
                "asignada a otra area", "gestión incompleta", "gestion incompleta").contains(s);
    }

    /**
     * Las cabeceras del Sheet a veces llevan tildes (FECHA_ASIGNACIÓN) y a veces no
     * (FECHA_ASIGNACION) según quién las haya escrito — se normaliza sin acentos para que
     * el lookup por nombre de columna sea consistente sin tener que mantener alias a mano.
     */
    private static String normalizarHeader(String s) {
        String sinTildes = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return sinTildes.trim().toUpperCase();
    }

    private Map<String, Integer> headerIndex(List<Object> headerRow) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headerRow.size(); i++) {
            String h = normalizarHeader(String.valueOf(headerRow.get(i)));
            if (!h.isBlank()) map.putIfAbsent(h, i);
        }
        return map;
    }

    private String val(List<Object> row, Map<String, Integer> col, String header) {
        Integer idx = col.get(normalizarHeader(header));
        if (idx == null || idx >= row.size()) return "";
        Object v = row.get(idx);
        return v == null ? "" : v.toString();
    }

    private String nullToEmpty(String s) { return s == null ? "" : s; }

    /** Convierte índice de columna 0-based a letra A1 (0->A, 25->Z, 26->AA...). */
    private static String colLetter(int index) {
        StringBuilder sb = new StringBuilder();
        int n = index;
        do {
            sb.insert(0, (char) ('A' + (n % 26)));
            n = n / 26 - 1;
        } while (n >= 0);
        return sb.toString();
    }
}
