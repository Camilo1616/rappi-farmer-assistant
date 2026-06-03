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
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoogleCalendarService {

    private static final String CALENDAR_NAME    = "Handoffs";
    private static final String TITLE_PREFIX     = "Comienza a Vender HOY";
    // Extrae el código de tienda del título: "Comienza a Vender HOY - Nombre Tienda (PE74224)"
    private static final Pattern STORE_CODE_PATTERN = Pattern.compile("\\(([A-Z]{2}\\d+)\\)");
    private static final GsonFactory JSON_FACTORY  = GsonFactory.getDefaultInstance();

    @Value("${google.calendar.client-id}")
    private String clientId;

    @Value("${google.calendar.client-secret}")
    private String clientSecret;

    @Value("${google.calendar.redirect-uri}")
    private String redirectUri;

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;

    // ── OAuth: generar URL de autorización ───────────────────────────────────

    public String buildAuthUrl(Long userId) throws GeneralSecurityException, IOException {
        GoogleAuthorizationCodeFlow flow = buildFlow();
        return flow.newAuthorizationUrl()
                .setRedirectUri(redirectUri)
                .setState(String.valueOf(userId))
                .set("access_type", "offline")
                .set("prompt", "consent")
                .build();
    }

    // ── OAuth: procesar callback y guardar refresh token ─────────────────────

    @Transactional
    public void handleCallback(String code, Long userId) throws GeneralSecurityException, IOException {
        GoogleAuthorizationCodeFlow flow = buildFlow();
        GoogleTokenResponse tokenResponse = flow.newTokenRequest(code)
                .setRedirectUri(redirectUri)
                .execute();

        String refreshToken = tokenResponse.getRefreshToken();
        if (refreshToken == null) {
            log.warn("No se recibió refresh_token para usuario {}. El usuario debe revocar y reconectar.", userId);
            return;
        }

        userRepository.findById(userId).ifPresent(user -> {
            user.setCalendarRefreshToken(refreshToken);
            userRepository.save(user);
            log.info("Google Calendar conectado para usuario {}", user.getEmail());
        });
    }

    // ── Job: sincronizar HO desde calendarios conectados ────────────────────

    @Scheduled(fixedDelay = 60 * 60 * 1000) // cada hora
    @Transactional
    public void syncHandoffs() {
        List<User> users = userRepository.findByCalendarRefreshTokenIsNotNull();
        if (users.isEmpty()) return;

        log.info("Sincronizando HO desde Google Calendar — {} usuarios conectados", users.size());
        for (User user : users) {
            try {
                syncUserHandoffs(user);
            } catch (Exception e) {
                log.warn("Error sincronizando HO de {}: {}", user.getEmail(), e.getMessage());
            }
        }
        // Activar tiendas Self que aún no tienen handoff_activated_at
        activarTiendasSelf();
    }

    /** Las tiendas Self no necesitan HO — se activan desde onboarding_date al sincronizar */
    private void activarTiendasSelf() {
        storeRepository.findAll().stream()
            .filter(s -> Boolean.TRUE.equals(s.getActive()))
            .filter(s -> s.getHandoffActivatedAt() == null)
            .filter(s -> s.getChannel() != null && s.getChannel().toLowerCase().contains("self"))
            .forEach(s -> {
                s.setHandoffActivatedAt(
                    s.getOnboardingDate() != null ? s.getOnboardingDate() : LocalDate.now());
                storeRepository.save(s);
                log.info("Self activado automáticamente — tienda:{}", s.getStoreCode());
            });
    }

    private void syncUserHandoffs(User user) throws GeneralSecurityException, IOException {
        Calendar calendar = buildCalendarClient(user.getCalendarRefreshToken());

        // Buscar el calendario "Handoffs"
        String calendarId = findCalendarId(calendar, CALENDAR_NAME);
        if (calendarId == null) {
            log.debug("Usuario {} no tiene calendario '{}'", user.getEmail(), CALENDAR_NAME);
            return;
        }

        // Traer eventos de los últimos 20 días
        Date desde = Date.from(LocalDate.now().minusDays(20)
                .atStartOfDay(ZoneId.systemDefault()).toInstant());

        Events events = calendar.events().list(calendarId)
                .setTimeMin(new com.google.api.client.util.DateTime(desde))
                .setOrderBy("startTime")
                .setSingleEvents(true)
                .setQ(TITLE_PREFIX)
                .execute();

        if (events.getItems() == null) return;

        for (Event event : events.getItems()) {
            processEvent(event, user);
        }
    }

    private void processEvent(Event event, User user) {
        String title = event.getSummary();
        if (title == null || !title.contains(TITLE_PREFIX)) return;

        Matcher matcher = STORE_CODE_PATTERN.matcher(title);
        if (!matcher.find()) {
            log.debug("No se encontró código de tienda en: {}", title);
            return;
        }

        String brandId = matcher.group(1);
        // El código en el título del evento es COUNTRY BRAND ID, no COUNTRY STORE ID
        Optional<Store> storeOpt = storeRepository.findByBrandId(brandId);
        if (storeOpt.isEmpty()) {
            log.debug("Tienda con brandId {} no encontrada en BD", brandId);
            return;
        }

        Store store = storeOpt.get();

        // Validar que el HO fue exitoso: duración > 10 min O asistente externo (no @rappi.com)
        if (!isHandoffExitoso(event)) {
            log.debug("HO descartado (duración < 10 min y sin asistente externo) — tienda:{}", storeCode);
            return;
        }

        // Extraer fecha del evento
        LocalDate eventDate;
        if (event.getStart().getDate() != null) {
            eventDate = LocalDate.parse(event.getStart().getDate().toString());
        } else {
            eventDate = new java.util.Date(event.getStart().getDateTime().getValue())
                    .toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }

        // Solo actualizar si no tenía handoff_activated_at o si este evento es más reciente
        if (store.getHandoffActivatedAt() == null || eventDate.isAfter(store.getHandoffActivatedAt())) {
            store.setHadHandoff(true);
            store.setHandoffActivatedAt(eventDate);
            storeRepository.save(store);
            log.info("HO exitoso registrado — tienda:{} fecha:{} (calendar de {})",
                    storeCode, eventDate, user.getEmail());
        }
    }

    /**
     * Un HO se considera exitoso si:
     * 1. La reunión duró más de 10 minutos, O
     * 2. Asistió al menos un invitado con correo externo (no @rappi.com)
     */
    private boolean isHandoffExitoso(Event event) {
        // Criterio 1: duración > 10 minutos
        if (event.getStart() != null && event.getEnd() != null
                && event.getStart().getDateTime() != null && event.getEnd().getDateTime() != null) {
            long duracionMs = event.getEnd().getDateTime().getValue()
                    - event.getStart().getDateTime().getValue();
            if (duracionMs > 10 * 60 * 1000L) return true;
        }

        // Criterio 2: hay al menos un asistente con email externo a rappi.com
        if (event.getAttendees() != null) {
            boolean tieneExterno = event.getAttendees().stream()
                    .anyMatch(a -> a.getEmail() != null
                            && !a.getEmail().toLowerCase().endsWith("@rappi.com")
                            && !a.getEmail().toLowerCase().endsWith("@resource.calendar.google.com"));
            if (tieneExterno) return true;
        }

        return false;
    }

    private String findCalendarId(Calendar calendar, String name) throws IOException {
        return calendar.calendarList().list().execute().getItems().stream()
                .filter(c -> name.equalsIgnoreCase(c.getSummary()))
                .map(com.google.api.services.calendar.model.CalendarListEntry::getId)
                .findFirst()
                .orElse(null);
    }

    // ── Builders ─────────────────────────────────────────────────────────────

    private GoogleAuthorizationCodeFlow buildFlow() throws GeneralSecurityException, IOException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
        GoogleClientSecrets secrets = new GoogleClientSecrets()
                .setInstalled(new GoogleClientSecrets.Details()
                        .setClientId(clientId)
                        .setClientSecret(clientSecret));
        return new GoogleAuthorizationCodeFlow.Builder(transport, JSON_FACTORY, secrets,
                List.of(CalendarScopes.CALENDAR_READONLY))
                .setAccessType("offline")
                .build();
    }

    private Calendar buildCalendarClient(String refreshToken) throws GeneralSecurityException, IOException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
        Credential credential = new Credential.Builder(BearerToken.authorizationHeaderAccessMethod())
                .setTransport(transport)
                .setJsonFactory(JSON_FACTORY)
                .setTokenServerUrl(new com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/token"))
                .setClientAuthentication(new ClientParametersAuthentication(clientId, clientSecret))
                .build()
                .setRefreshToken(refreshToken);
        credential.refreshToken();
        return new Calendar.Builder(transport, JSON_FACTORY, credential)
                .setApplicationName("Rappi Farmer Assistant")
                .build();
    }
}
