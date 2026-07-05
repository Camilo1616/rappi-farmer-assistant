package com.rappi.assistant.infrastructure.persistence.adapter;

import com.rappi.assistant.domain.repositories.WhatsappMessageRepository;
import com.rappi.assistant.infrastructure.persistence.entity.UserEntity;
import com.rappi.assistant.infrastructure.persistence.entity.WhatsappMessageEntity;
import com.rappi.assistant.infrastructure.persistence.repository.UserJpaRepository;
import com.rappi.assistant.infrastructure.persistence.repository.WhatsappMessageJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Repository
@RequiredArgsConstructor
@Transactional
public class WhatsappMessageRepositoryAdapter implements WhatsappMessageRepository {

    private final WhatsappMessageJpaRepository jpaRepository;
    private final UserJpaRepository userJpaRepository;

    @Override
    public void save(Long contactId, String contactName, Long userId, String message, String status, String errorMessage) {
        try {
            UserEntity user = userId != null ? userJpaRepository.findById(userId).orElse(null) : null;
            WhatsappMessageEntity entity = new WhatsappMessageEntity();
            entity.setContactId(contactId);
            entity.setContactName(contactName);
            entity.setUser(user);
            entity.setMessage(message);
            entity.setStatus(status.startsWith("ERROR") ? "ERROR" : status);
            entity.setErrorMessage(status.startsWith("ERROR") ? status : null);
            entity.setSentAt(LocalDateTime.now());
            jpaRepository.save(entity);
        } catch (Exception e) {
            log.error("Error guardando log de WhatsApp para contacto {}: {}", contactId, e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public long countSentToday() {
        LocalDateTime start = LocalDate.now(java.time.ZoneId.of("America/Bogota")).atStartOfDay();
        return jpaRepository.countSentToday(start, start.plusDays(1));
    }

    @Override
    @Transactional(readOnly = true)
    public long countSentTodayByUser(Long userId) {
        LocalDateTime[] bounds = todayBoundsUtc();
        return jpaRepository.countSentTodayByUser(bounds[0], bounds[1], userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> findStoresSentToday(Long userId) {
        LocalDateTime[] bounds = todayBoundsUtc();
        return jpaRepository.findContactsSentToday(bounds[0], bounds[1], userId)
                .stream()
                .map(m -> {
                    Map<String, Object> map = new java.util.LinkedHashMap<>();
                    map.put("id",   m.getContactId());
                    map.put("name", m.getContactName() != null ? m.getContactName() : "");
                    return map;
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> findHistory(Long userId, int days) {
        ZoneId bogota = ZoneId.of("America/Bogota");
        LocalDateTime since = ZonedDateTime.now(bogota).minusDays(days)
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        List<WhatsappMessageEntity> messages = jpaRepository.findHistorySince(since, userId);

        // Agrupar por fecha (en timezone Bogota)
        DateTimeFormatter dayFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, Map<String, Object>> byDay = new LinkedHashMap<>();
        for (var m : messages) {
            String day = m.getSentAt().atZone(ZoneOffset.UTC)
                    .withZoneSameInstant(bogota)
                    .format(dayFmt);
            byDay.computeIfAbsent(day, d -> {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("date", d);
                entry.put("enviados", 0);
                entry.put("errores", 0);
                entry.put("noValidos", 0);
                entry.put("contacts", new ArrayList<Map<String, Object>>());
                return entry;
            });
            Map<String, Object> entry = byDay.get(day);
            String status = m.getStatus() != null ? m.getStatus() : "ERROR";
            if ("ENVIADO".equals(status))           entry.merge("enviados", 1, (a, b) -> (int) a + (int) b);
            else if ("NUMERO_INVALIDO".equals(status)) entry.merge("noValidos", 1, (a, b) -> (int) a + (int) b);
            else                                        entry.merge("errores", 1, (a, b) -> (int) a + (int) b);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> contacts = (List<Map<String, Object>>) entry.get("contacts");
            Map<String, Object> contactInfo = new LinkedHashMap<>();
            contactInfo.put("name",         m.getContactName() != null ? m.getContactName() : "");
            contactInfo.put("status",       status);
            contactInfo.put("errorMessage", m.getErrorMessage() != null ? m.getErrorMessage() : "");
            contactInfo.put("sentAt",       m.getSentAt().atZone(ZoneOffset.UTC)
                    .withZoneSameInstant(bogota)
                    .format(DateTimeFormatter.ofPattern("HH:mm")));
            contacts.add(contactInfo);
        }
        // Calcular total por día
        byDay.values().forEach(e -> {
            @SuppressWarnings("unchecked")
            List<?> s = (List<?>) e.get("contacts");
            e.put("total", s.size());
        });
        return new ArrayList<>(byDay.values());
    }

    /** Límites de "hoy" en Bogota convertidos a UTC para comparar con sentAt UTC */
    private LocalDateTime[] todayBoundsUtc() {
        ZoneId bogota = ZoneId.of("America/Bogota");
        LocalDate todayBogota = LocalDate.now(bogota);
        LocalDateTime startUtc = todayBogota.atStartOfDay(bogota)
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        LocalDateTime endUtc   = todayBogota.plusDays(1).atStartOfDay(bogota)
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        return new LocalDateTime[]{ startUtc, endUtc };
    }
}
