package com.rappi.farmer.application.services;

import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventAttendee;
import com.google.api.services.calendar.model.EventDateTime;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.domain.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class GoogleCalendarServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private StoreRepository storeRepository;

    private GoogleCalendarService service;

    @BeforeEach
    void setUp() {
        service = new GoogleCalendarService(userRepository, storeRepository);
        ReflectionTestUtils.setField(service, "clientId", "test-client-id");
        ReflectionTestUtils.setField(service, "clientSecret", "test-secret");
        ReflectionTestUtils.setField(service, "redirectUri", "http://localhost/callback");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Event eventConDuracion(long minutos) {
        long ahora = System.currentTimeMillis();
        Event e = new Event();
        e.setStart(new EventDateTime().setDateTime(new DateTime(ahora)));
        e.setEnd(new EventDateTime().setDateTime(new DateTime(ahora + minutos * 60_000L)));
        return e;
    }

    /** Crea evento con duración larga (20 min) y los correos dados */
    private Event eventConAttendees(String... emails) {
        Event e = eventConDuracion(20);
        e.setAttendees(Arrays.stream(emails)
                .map(mail -> new EventAttendee().setEmail(mail))
                .toList());
        return e;
    }

    /** Crea evento corto (5 min) con los correos dados */
    private Event eventCortoConAttendees(String... emails) {
        Event e = eventConDuracion(5);
        e.setAttendees(Arrays.stream(emails)
                .map(mail -> new EventAttendee().setEmail(mail))
                .toList());
        return e;
    }

    // ── exitoso: ambos criterios deben cumplirse ─────────────────────────────

    @Test
    void hoExitoso_duracionMayor15YExternoPresente() {
        assertThat(service.isHandoffExitoso(eventConAttendees("aliado@gmail.com"))).isTrue();
    }

    @Test
    void hoExitoso_mezclado_internoYExterno_duracionOk() {
        assertThat(service.isHandoffExitoso(eventConAttendees(
                "farmer@rappi.com", "aliado@hotmail.com"))).isTrue();
    }

    // ── no exitoso: falta uno o ambos criterios ──────────────────────────────

    @Test
    void hoNoExitoso_duracionOk_peroSoloInternos() {
        assertThat(service.isHandoffExitoso(eventConAttendees(
                "farmer@rappi.com", "lider@rappi.com"))).isFalse();
    }

    @Test
    void hoNoExitoso_externoPresente_peroDuracionCorta() {
        assertThat(service.isHandoffExitoso(eventCortoConAttendees("aliado@gmail.com"))).isFalse();
    }

    @Test
    void hoNoExitoso_duracionExacta15Minutos_conExterno() {
        long ahora = System.currentTimeMillis();
        Event e = new Event();
        e.setStart(new EventDateTime().setDateTime(new DateTime(ahora)));
        e.setEnd(new EventDateTime().setDateTime(new DateTime(ahora + 15 * 60_000L)));
        e.setAttendees(List.of(new EventAttendee().setEmail("aliado@gmail.com")));
        assertThat(service.isHandoffExitoso(e)).isFalse();
    }

    @Test
    void hoNoExitoso_soloSalaCalendario() {
        assertThat(service.isHandoffExitoso(eventConAttendees(
                "sala@resource.calendar.google.com"))).isFalse();
    }

    @Test
    void hoNoExitoso_sinAttendees() {
        assertThat(service.isHandoffExitoso(eventConDuracion(20))).isFalse();
    }

    @Test
    void hoNoExitoso_listaAttendeesVacia() {
        Event e = eventConDuracion(20);
        e.setAttendees(List.of());
        assertThat(service.isHandoffExitoso(e)).isFalse();
    }

    @Test
    void hoNoExitoso_eventoSinFechaHora_duracionIndeterminada() {
        Event e = new Event();
        e.setStart(new EventDateTime().setDate(new DateTime(true, System.currentTimeMillis(), 0)));
        e.setEnd(new EventDateTime().setDate(new DateTime(true, System.currentTimeMillis() + 3_600_000L, 0)));
        e.setAttendees(List.of(new EventAttendee().setEmail("aliado@gmail.com")));
        assertThat(service.isHandoffExitoso(e)).isFalse();
    }
}
