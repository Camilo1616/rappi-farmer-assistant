package com.rappi.farmer.application.services;

import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.ClientParametersAuthentication;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.CalendarScopes;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.Events;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoogleCalendarService {

    private static final String CALENDAR_NAME    = "Handoffs";
    private static final String TITLE_PREFIX     = "Comienza a Vender HOY";
    private static final Pattern STORE_CODE_PATTERN = Pattern.compile("\\(([A-Z]{2}\\d+)\\)");
    private static final GsonFactory JSON_FACTORY  = GsonFactory.getDefaultInstance();
    private static final String MEET_API_BASE      = "https://meet.googleapis.com/v2";

    // ── Records públicos ──────────────────────────────────────────────────────

    public record FailedHandoffInfo(
            String brandId,
            String storeName,
            LocalDate rejectedAt,
            String reason,
            LocalDate rescheduledAt,
            boolean rescheduledSuccess
    ) {}

    public record MeetParticipant(
            String displayName,
            boolean esExterno,       // inferido: no es usuario interno de Rappi
            long tiempoEnReunionMin
    ) {}

    public record HandoffSummaryInfo(
            String brandId,
            String storeName,
            String farmerEmail,
            LocalDate eventDate,
            String eventTime,
            long duracionProgramadaMin,
            Long duracionRealMin,          // null si reunión futura o sin datos Meet
            Boolean alinadoConectado,      // null si sin datos Meet
            List<MeetParticipant> participantes,
            String meetRecordId,
            boolean exitoso,
            boolean tieneExterno,
            boolean duracionOk,
            List<String> attendeeEmails,
            String reason
    ) {}

    private final List<FailedHandoffInfo>  failedHandoffs  = new java.util.concurrent.CopyOnWriteArrayList<>();
    private final List<HandoffSummaryInfo> handoffSummary  = new java.util.concurrent.CopyOnWriteArrayList<>();

    // Flag persistente en memoria: true en cuanto una llamada al Meet API devuelve 200
    private volatile boolean meetApiAccesible = false;

    public List<FailedHandoffInfo>  getFailedHandoffs()  { return failedHandoffs; }
    public List<HandoffSummaryInfo> getHandoffSummary()  { return handoffSummary; }
    public boolean isMeetApiAccesible()                  { return meetApiAccesible; }

    @Autowired(required = false)
    private RealtimeService realtimeService;

    @Value("${google.calendar.client-id}")
    private String clientId;

    @Value("${google.calendar.client-secret}")
    private String clientSecret;

    @Value("${google.calendar.redirect-uri}")
    private String redirectUri;

    private final UserRepository  userRepository;
    private final StoreRepository storeRepository;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    // ── OAuth ─────────────────────────────────────────────────────────────────

    public String buildAuthUrl(Long userId) throws GeneralSecurityException, IOException {
        return buildFlow().newAuthorizationUrl()
                .setRedirectUri(redirectUri)
                .setState(String.valueOf(userId))
                .set("access_type", "offline")
                .set("prompt", "consent")
                .build();
    }

    @Transactional
    public void handleCallback(String code, Long userId) throws GeneralSecurityException, IOException {
        GoogleTokenResponse tokenResponse = buildFlow().newTokenRequest(code)
                .setRedirectUri(redirectUri).execute();
        String refreshToken = tokenResponse.getRefreshToken();
        if (refreshToken == null) {
            log.warn("No se recibió refresh_token para usuario {}", userId);
            return;
        }
        userRepository.findById(userId).ifPresent(user -> {
            user.setCalendarRefreshToken(refreshToken);
            userRepository.save(user);
            log.info("Google Calendar+Meet conectado para usuario {}", user.getEmail());
        });
    }

    // ── Sync principal ────────────────────────────────────────────────────────

    @Scheduled(fixedDelay = 60 * 60 * 1000)
    @Transactional
    public Map<String, Object> syncHandoffs() {
        List<User> users = userRepository.findByCalendarRefreshTokenIsNotNull();
        failedHandoffs.clear();
        handoffSummary.clear();
        int totalActivados = 0;
        for (User user : users) {
            try {
                totalActivados += syncUserHandoffs(user, 14);
            } catch (Exception e) {
                log.warn("Error sincronizando HO de {}: {}", user.getEmail(), e.getMessage());
            }
        }
        int selfActivados = activarTiendasSelf();
        log.info("Sync completo — HO:{} Self:{} meetApi:{} usuarios:{}",
                totalActivados, selfActivados, meetApiAccesible, users.size());
        return Map.of("hoActivados", totalActivados, "selfActivados", selfActivados,
                "usuariosSincronizados", users.size(), "meetApiAccesible", meetApiAccesible);
    }

    @Transactional
    public void syncOnLogin(User user, int daysBack) {
        if (user.getCalendarRefreshToken() == null) return;
        try {
            syncUserHandoffs(user, daysBack);
        } catch (Exception e) {
            log.warn("Error en sync login para {}: {}", user.getEmail(), e.getMessage());
        }
    }

    private int activarTiendasSelf() {
        var stores = storeRepository.findActiveSelfWithoutHandoff();
        stores.forEach(s -> {
            s.setHandoffActivatedAt(s.getOnboardingDate() != null ? s.getOnboardingDate() : LocalDate.now());
            storeRepository.save(s);
        });
        return stores.size();
    }

    // ── Sync por usuario ──────────────────────────────────────────────────────

    private int syncUserHandoffs(User user, int daysBack) throws GeneralSecurityException, IOException {
        Credential credential = buildCredential(user.getCalendarRefreshToken());
        Calendar calendar = new Calendar.Builder(
                GoogleNetHttpTransport.newTrustedTransport(), JSON_FACTORY, credential)
                .setApplicationName("Rappi Farmer Assistant").build();

        List<com.google.api.services.calendar.model.CalendarListEntry> cals =
                calendar.calendarList().list().execute().getItems();
        String calendarId = cals.stream()
                .filter(c -> CALENDAR_NAME.equalsIgnoreCase(c.getSummary() != null ? c.getSummary().trim() : ""))
                .map(com.google.api.services.calendar.model.CalendarListEntry::getId)
                .findFirst().orElse("primary");

        Date desde = Date.from(LocalDate.now().minusDays(daysBack)
                .atStartOfDay(ZoneId.systemDefault()).toInstant());
        Date hasta = Date.from(LocalDate.now().plusDays(7)
                .atStartOfDay(ZoneId.systemDefault()).toInstant());

        Events events = calendar.events().list(calendarId)
                .setTimeMin(new com.google.api.client.util.DateTime(desde))
                .setTimeMax(new com.google.api.client.util.DateTime(hasta))
                .setOrderBy("startTime")
                .setSingleEvents(true)
                .setMaxResults(500)
                .execute();

        List<Event> items = events.getItems();
        if (items == null || items.isEmpty()) return 0;

        java.util.Map<String, java.util.List<Event>> byStore = new java.util.LinkedHashMap<>();
        for (Event e : items) {
            String title = e.getSummary();
            if (title == null || !title.contains(TITLE_PREFIX)) continue;
            Matcher m = STORE_CODE_PATTERN.matcher(title);
            if (m.find()) byStore.computeIfAbsent(m.group(1), k -> new java.util.ArrayList<>()).add(e);
        }

        String accessToken = credential.getAccessToken();

        // Verificar acceso al Meet API con una llamada de prueba liviana
        if (!meetApiAccesible) probeMeetApi(accessToken);

        LocalDate today = LocalDate.now();
        int activados = 0;
        for (java.util.Map.Entry<String, java.util.List<Event>> entry : byStore.entrySet()) {
            java.util.List<Event> sorted = entry.getValue().stream()
                    .sorted(java.util.Comparator.comparingLong(GoogleCalendarService::getEventMillis))
                    .toList();
            activados += processStoreEvents(entry.getKey(), sorted, today, user.getEmail(), accessToken);
        }
        return activados;
    }

    // ── Procesamiento por tienda ──────────────────────────────────────────────

    private int processStoreEvents(String brandId, java.util.List<Event> events,
                                   LocalDate today, String farmerEmail, String accessToken) {
        Optional<Store> storeOpt = storeRepository.findByBrandId(brandId);
        if (storeOpt.isEmpty()) storeOpt = storeRepository.findByStoreCode(brandId);
        if (storeOpt.isEmpty()) { log.warn("Tienda '{}' no en BD", brandId); return 0; }

        Store store = storeOpt.get();
        String channel = store.getChannel() != null ? store.getChannel().toLowerCase() : "";
        boolean esHunting = channel.contains("hunting") || channel.contains("inside");

        LocalDate firstRejectedAt = null;
        String firstRejectedReason = null;
        LocalDate rescheduledAt = null;
        boolean rescheduledSuccess = false;
        int activados = 0;

        for (Event event : events) {
            LocalDate eventDate = extractEventDate(event);
            boolean isPast = !eventDate.isAfter(today);

            // Correos externos invitados por Calendar (para comparar con participantes Meet)
            List<String> calAttendees  = extractAttendeeEmails(event);
            int internalRappiCount = (int) calAttendees.stream()
                    .filter(e -> e.endsWith("@rappi.com")).count();

            // Datos reales del Meet API (solo eventos pasados)
            MeetData meetData = null;
            if (isPast && meetApiAccesible) {
                String meetingCode = extractMeetingCode(event);
                if (meetingCode != null) meetData = fetchMeetData(meetingCode, accessToken, internalRappiCount);
            }

            // Validación exitoso
            boolean exitoso = meetData != null
                    ? meetData.duracionRealMin() > 15 && meetData.alinadoConectado()
                    : isHandoffExitoso(event);

            // Lógica reagendado (solo Hunting)
            if (esHunting && firstRejectedAt == null) {
                if (isPast) {
                    firstRejectedAt = eventDate;
                    firstRejectedReason = meetData != null
                            ? buildMeetRejectionReason(meetData)
                            : buildRejectionReason(event);
                } else {
                    LocalDate createdDate = event.getCreated() != null
                            ? new java.util.Date(event.getCreated().getValue())
                                    .toInstant().atZone(ZoneId.systemDefault()).toLocalDate()
                            : null;
                    if (createdDate != null && !createdDate.isAfter(today)) {
                        firstRejectedAt = createdDate;
                        firstRejectedReason = "HO no realizado — reagendado";
                        rescheduledAt = eventDate;
                    }
                }
            } else if (esHunting && firstRejectedAt != null && rescheduledAt == null) {
                rescheduledAt = eventDate;
                rescheduledSuccess = exitoso;
            }

            // Registrar en summary
            long durProgramada = calcDuracionMinutos(event);
            boolean externo    = tieneAsistenteExterno(event);
            boolean durOk      = meetData != null ? meetData.duracionRealMin() > 15 : durProgramada > 15;

            String motivo = exitoso ? null
                    : meetData != null ? buildMeetRejectionReason(meetData)
                    : (!durOk && !externo) ? "Sin externo y duración ≤ 15 min"
                    : !externo             ? "Sin correo externo a Rappi"
                    : !durOk               ? "Duración agendada ≤ 15 min"
                    : null;

            handoffSummary.add(new HandoffSummaryInfo(
                    brandId, store.getStoreName(), farmerEmail,
                    eventDate, extractEventTime(event),
                    durProgramada,
                    meetData != null ? meetData.duracionRealMin() : null,
                    meetData != null ? meetData.alinadoConectado() : null,
                    meetData != null ? meetData.participantes() : List.of(),
                    meetData != null ? meetData.recordId() : null,
                    exitoso, externo, durOk, calAttendees, motivo));

            // Activar tienda
            if (!esHunting || exitoso) {
                if (store.getHandoffActivatedAt() == null || eventDate.isAfter(store.getHandoffActivatedAt())) {
                    store.setHadHandoff(true);
                    store.setHandoffActivatedAt(eventDate);
                    storeRepository.save(store);
                    if (realtimeService != null) realtimeService.storeUpdated(store.getId(), "HANDOFF_ACTIVATED");
                    activados++;
                }
            }
        }

        if (firstRejectedAt != null) {
            failedHandoffs.add(new FailedHandoffInfo(brandId, store.getStoreName(),
                    firstRejectedAt, firstRejectedReason, rescheduledAt, rescheduledSuccess));
        }
        return activados;
    }

    // ── Google Meet API ───────────────────────────────────────────────────────

    private record MeetData(
            String recordId,
            long duracionRealMin,
            boolean alinadoConectado,
            List<MeetParticipant> participantes
    ) {}

    /**
     * Prueba liviana para saber si el access token tiene el scope de Meet.
     * Llama al endpoint de lista de conferenceRecords con pageSize=1.
     * Si devuelve 200 (aunque sea lista vacía), el scope está habilitado.
     */
    private void probeMeetApi(String accessToken) {
        try {
            JsonObject res = meetGet(MEET_API_BASE + "/conferenceRecords?pageSize=1", accessToken);
            if (res != null) {
                meetApiAccesible = true;
                log.info("Meet API accesible — scope de Meet confirmado");
            }
        } catch (Exception e) {
            log.debug("Meet API no accesible aún: {}", e.getMessage());
        }
    }

    /**
     * Extrae el código de reunión Meet del evento de Calendar.
     * Formato: "abc-defg-hij" → normalizado sin guiones para el filtro API.
     */
    private String extractMeetingCode(Event event) {
        try {
            if (event.getConferenceData() == null) return null;
            var entryPoints = event.getConferenceData().getEntryPoints();
            if (entryPoints != null) {
                for (var ep : entryPoints) {
                    if ("video".equals(ep.getEntryPointType()) && ep.getUri() != null) {
                        String[] parts = ep.getUri().split("/");
                        if (parts.length > 0) return parts[parts.length - 1]; // "abc-defg-hij"
                    }
                }
            }
            return event.getConferenceData().getConferenceId();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Consulta Meet API para obtener duración real y participantes.
     * internalRappiCount: número de personas @rappi.com invitadas por Calendar,
     * usado para inferir si un participante de Meet es externo (el aliado).
     */
    private MeetData fetchMeetData(String meetingCode, String accessToken, int internalRappiCount) {
        try {
            // El filtro usa el código sin guiones y con formato correcto
            String codeNorm = meetingCode.replace("-", "");
            // Formato exacto que espera la Meet API: space.meeting_code = "abc..."
            String filterParam = "space.meeting_code = \"" + codeNorm + "\"";
            String encodedFilter = java.net.URLEncoder.encode(filterParam, java.nio.charset.StandardCharsets.UTF_8);
            String recordsUrl = MEET_API_BASE + "/conferenceRecords?filter=" + encodedFilter;

            JsonObject recordsJson = meetGet(recordsUrl, accessToken);
            if (recordsJson == null) return null;

            JsonArray records = recordsJson.has("conferenceRecords")
                    ? recordsJson.getAsJsonArray("conferenceRecords") : null;
            if (records == null || records.isEmpty()) {
                log.debug("Sin conferenceRecords para meetingCode: {}", meetingCode);
                return null;
            }

            // Tomar el registro más reciente
            JsonObject record = records.get(records.size() - 1).getAsJsonObject();
            String recordName = record.get("name").getAsString();

            // Duración real
            long duracionRealMin = 0;
            if (record.has("startTime") && record.has("endTime")) {
                Instant start = Instant.parse(record.get("startTime").getAsString());
                Instant end   = Instant.parse(record.get("endTime").getAsString());
                duracionRealMin = java.time.Duration.between(start, end).toMinutes();
            }

            // Participantes
            String participantsUrl = MEET_API_BASE + "/" + recordName + "/participants";
            JsonObject participantsJson = meetGet(participantsUrl, accessToken);
            List<MeetParticipant> participantes = new java.util.ArrayList<>();

            if (participantsJson != null && participantsJson.has("participants")) {
                JsonArray parts = participantsJson.getAsJsonArray("participants");
                for (JsonElement pe : parts) {
                    JsonObject p = pe.getAsJsonObject();
                    String displayName = resolveDisplayName(p);
                    long tiempoMin = 0;
                    if (p.has("earliestStartTime") && p.has("latestEndTime")) {
                        Instant s  = Instant.parse(p.get("earliestStartTime").getAsString());
                        Instant en = Instant.parse(p.get("latestEndTime").getAsString());
                        tiempoMin  = java.time.Duration.between(s, en).toMinutes();
                    }
                    participantes.add(new MeetParticipant(displayName, false, tiempoMin));
                }
            }

            // Inferir aliado conectado: si hay más participantes que internos de Rappi, hay un externo
            boolean alinadoConectado = participantes.size() > internalRappiCount;

            // Marcar los últimos (los "extras" sobre el count interno) como externos
            List<MeetParticipant> participantesConFlag = new java.util.ArrayList<>();
            int internos = 0;
            for (MeetParticipant mp : participantes) {
                boolean esExterno = internos >= internalRappiCount;
                participantesConFlag.add(new MeetParticipant(mp.displayName(), esExterno, mp.tiempoEnReunionMin()));
                if (!esExterno) internos++;
            }

            return new MeetData(recordName, duracionRealMin, alinadoConectado, participantesConFlag);

        } catch (Exception e) {
            log.debug("Error fetchMeetData para {}: {}", meetingCode, e.getMessage());
            return null;
        }
    }

    private String resolveDisplayName(JsonObject participant) {
        if (participant.has("signedinUser")) {
            JsonObject su = participant.getAsJsonObject("signedinUser");
            if (su.has("displayName")) return su.get("displayName").getAsString();
        }
        if (participant.has("anonymousUser")) {
            JsonObject au = participant.getAsJsonObject("anonymousUser");
            if (au.has("displayName")) return au.get("displayName").getAsString();
            return "Usuario anónimo";
        }
        if (participant.has("phoneUser")) {
            JsonObject pu = participant.getAsJsonObject("phoneUser");
            if (pu.has("displayName")) return pu.get("displayName").getAsString();
            return "Usuario de teléfono";
        }
        return "Participante desconocido";
    }

    private JsonObject meetGet(String url, String accessToken) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 200) {
                return JsonParser.parseString(res.body()).getAsJsonObject();
            }
            log.debug("Meet API HTTP {} para URL: {}", res.statusCode(), url);
            return null;
        } catch (Exception e) {
            log.debug("Error HTTP Meet API: {}", e.getMessage());
            return null;
        }
    }

    private String buildMeetRejectionReason(MeetData data) {
        if (data.duracionRealMin() == 0) return "Reunión sin duración registrada";
        if (!data.alinadoConectado() && data.duracionRealMin() <= 15)
            return "Aliado no se conectó y duración real ≤ 15 min (" + data.duracionRealMin() + " min)";
        if (!data.alinadoConectado()) return "Aliado externo no se conectó";
        if (data.duracionRealMin() <= 15) return "Duración real ≤ 15 min (" + data.duracionRealMin() + " min)";
        return null;
    }

    // ── Helpers Calendar ──────────────────────────────────────────────────────

    boolean isHandoffExitoso(Event event) {
        return calcDuracionMinutos(event) > 15 && tieneAsistenteExterno(event);
    }

    private boolean tieneAsistenteExterno(Event event) {
        if (event.getAttendees() == null) return false;
        return event.getAttendees().stream()
                .anyMatch(a -> a.getEmail() != null
                        && !a.getEmail().toLowerCase().endsWith("@rappi.com")
                        && !a.getEmail().toLowerCase().endsWith("@resource.calendar.google.com"));
    }

    private long calcDuracionMinutos(Event event) {
        if (event.getStart() == null || event.getEnd() == null) return 0;
        long startMs = event.getStart().getDateTime() != null
                ? event.getStart().getDateTime().getValue()
                : LocalDate.parse(event.getStart().getDate().toString())
                        .atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
        long endMs = event.getEnd().getDateTime() != null
                ? event.getEnd().getDateTime().getValue()
                : LocalDate.parse(event.getEnd().getDate().toString())
                        .atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
        return (endMs - startMs) / 60_000;
    }

    private LocalDate extractEventDate(Event event) {
        if (event.getStart().getDate() != null)
            return LocalDate.parse(event.getStart().getDate().toString());
        return new java.util.Date(event.getStart().getDateTime().getValue())
                .toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private String extractEventTime(Event event) {
        if (event.getStart() == null || event.getStart().getDateTime() == null) return null;
        return new java.util.Date(event.getStart().getDateTime().getValue())
                .toInstant().atZone(ZoneId.systemDefault())
                .toLocalTime().toString().substring(0, 5);
    }

    private List<String> extractAttendeeEmails(Event event) {
        if (event.getAttendees() == null) return List.of();
        return event.getAttendees().stream()
                .map(a -> a.getEmail())
                .filter(e -> e != null && !e.endsWith("@resource.calendar.google.com"))
                .toList();
    }

    private String buildRejectionReason(Event event) {
        if (event.getAttendees() == null || event.getAttendees().isEmpty())
            return "Sin invitados en el evento";
        if (!tieneAsistenteExterno(event)) return "Sin aliado externo invitado";
        return "Aliado no confirmó asistencia";
    }

    private static long getEventMillis(Event event) {
        if (event.getStart() == null) return Long.MAX_VALUE;
        if (event.getStart().getDateTime() != null) return event.getStart().getDateTime().getValue();
        if (event.getStart().getDate() != null) {
            try {
                return LocalDate.parse(event.getStart().getDate().toString())
                        .atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
            } catch (Exception e) { return Long.MAX_VALUE; }
        }
        return Long.MAX_VALUE;
    }

    // ── OAuth builders ────────────────────────────────────────────────────────

    private GoogleAuthorizationCodeFlow buildFlow() throws GeneralSecurityException, IOException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
        GoogleClientSecrets secrets = new GoogleClientSecrets()
                .setWeb(new GoogleClientSecrets.Details()
                        .setClientId(clientId)
                        .setClientSecret(clientSecret));
        return new GoogleAuthorizationCodeFlow.Builder(transport, JSON_FACTORY, secrets,
                List.of(
                    CalendarScopes.CALENDAR_READONLY,
                    "https://www.googleapis.com/auth/meetings.space.readonly"
                ))
                .setAccessType("offline")
                .build();
    }

    private Credential buildCredential(String refreshToken) throws GeneralSecurityException, IOException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
        Credential credential = new Credential.Builder(BearerToken.authorizationHeaderAccessMethod())
                .setTransport(transport)
                .setJsonFactory(JSON_FACTORY)
                .setTokenServerUrl(new com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/token"))
                .setClientAuthentication(new ClientParametersAuthentication(clientId, clientSecret))
                .build()
                .setRefreshToken(refreshToken);
        credential.refreshToken();
        return credential;
    }
}
