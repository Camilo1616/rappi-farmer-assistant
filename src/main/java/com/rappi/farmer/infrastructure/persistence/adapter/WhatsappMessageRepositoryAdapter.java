package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.repositories.WhatsappMessageRepository;
import com.rappi.farmer.infrastructure.persistence.entity.StoreEntity;
import com.rappi.farmer.infrastructure.persistence.entity.UserEntity;
import com.rappi.farmer.infrastructure.persistence.entity.WhatsappMessageEntity;
import com.rappi.farmer.infrastructure.persistence.repository.StoreJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.UserJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.WhatsappMessageJpaRepository;
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
    private final StoreJpaRepository storeJpaRepository;
    private final UserJpaRepository userJpaRepository;

    @Override
    public void save(Long storeId, Long userId, String message, String status, String errorMessage) {
        try {
            StoreEntity store = storeJpaRepository.findById(storeId).orElse(null);
            if (store == null) {
                log.warn("No se encontró tienda {} para guardar log de WhatsApp", storeId);
                return;
            }
            UserEntity user = userId != null ? userJpaRepository.findById(userId).orElse(null) : null;
            WhatsappMessageEntity entity = new WhatsappMessageEntity();
            entity.setStore(store);
            entity.setUser(user);
            entity.setMessage(message);
            entity.setStatus(status.startsWith("ERROR") ? "ERROR" : status);
            entity.setErrorMessage(status.startsWith("ERROR") ? status : null);
            entity.setSentAt(LocalDateTime.now());
            jpaRepository.save(entity);
        } catch (Exception e) {
            log.error("Error guardando log de WhatsApp para tienda {}: {}", storeId, e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public long countSentToday() {
        LocalDateTime start = LocalDate.now().atStartOfDay();
        return jpaRepository.countSentToday(start, start.plusDays(1));
    }

    @Override
    public void deleteByStoreId(Long storeId) {
        jpaRepository.deleteByStoreId(storeId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> findStoresSentToday(Long userId) {
        LocalDateTime[] bounds = todayBoundsUtc();
        return jpaRepository.findStoresSentToday(bounds[0], bounds[1], userId)
                .stream()
                .map(s -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id",          s.getId());
                    m.put("storeName",   s.getStoreName()  != null ? s.getStoreName()  : "");
                    m.put("storeCode",   s.getStoreCode()  != null ? s.getStoreCode()  : "");
                    m.put("brandId",     s.getBrandId()    != null ? s.getBrandId()    : "");
                    m.put("phoneNumber", s.getPhoneNumber()!= null ? s.getPhoneNumber(): "");
                    return m;
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> findHistory(Long userId, int days) {
        ZoneId bogota = ZoneId.of("America/Bogota");
        LocalDateTime since = ZonedDateTime.now(bogota).minusDays(days)
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        List<com.rappi.farmer.infrastructure.persistence.entity.WhatsappMessageEntity> messages =
                jpaRepository.findHistorySince(since, userId);

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
                entry.put("stores", new ArrayList<Map<String, Object>>());
                return entry;
            });
            Map<String, Object> entry = byDay.get(day);
            String status = m.getStatus() != null ? m.getStatus() : "ERROR";
            if ("ENVIADO".equals(status))           entry.merge("enviados", 1, (a, b) -> (int) a + (int) b);
            else if ("NUMERO_INVALIDO".equals(status)) entry.merge("noValidos", 1, (a, b) -> (int) a + (int) b);
            else                                        entry.merge("errores", 1, (a, b) -> (int) a + (int) b);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> stores = (List<Map<String, Object>>) entry.get("stores");
            Map<String, Object> storeInfo = new LinkedHashMap<>();
            storeInfo.put("storeName",    m.getStore().getStoreName() != null ? m.getStore().getStoreName() : "");
            storeInfo.put("storeCode",    m.getStore().getStoreCode() != null ? m.getStore().getStoreCode() : "");
            storeInfo.put("brandId",      m.getStore().getBrandId() != null ? m.getStore().getBrandId() : "");
            storeInfo.put("phoneNumber",  m.getStore().getPhoneNumber() != null ? m.getStore().getPhoneNumber() : "");
            storeInfo.put("status",       status);
            storeInfo.put("errorMessage", m.getErrorMessage() != null ? m.getErrorMessage() : "");
            storeInfo.put("sentAt",       m.getSentAt().atZone(ZoneOffset.UTC)
                    .withZoneSameInstant(bogota)
                    .format(DateTimeFormatter.ofPattern("HH:mm")));
            stores.add(storeInfo);
        }
        // Calcular total por día
        byDay.values().forEach(e -> {
            @SuppressWarnings("unchecked")
            List<?> s = (List<?>) e.get("stores");
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
