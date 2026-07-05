package com.rappi.farmer.application.services;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.infrastructure.persistence.entity.NoteEntity;
import com.rappi.farmer.infrastructure.persistence.repository.ManagementJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.NoteJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProfileExtrasService {

    private final ManagementJpaRepository managementJpaRepository;
    private final NoteJpaRepository noteJpaRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SessionContext sessionContext;

    // ── Rendimiento personal ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getPerformance() {
        Long userId = sessionContext.getCurrentUserId();
        LocalDateTime since = LocalDate.now().minusDays(6).atStartOfDay();
        var all = managementJpaRepository.findByUserIdSince(userId, since);

        // Agrupar por día
        Map<LocalDate, List<com.rappi.farmer.infrastructure.persistence.entity.ManagementEntity>> byDay =
                all.stream()
                .filter(m -> !m.isBrandSync())
                .collect(Collectors.groupingBy(m -> m.getManagementDate().toLocalDate()));

        // Últimos 7 días con sus efectivas
        final int META = 15;
        List<Map<String, Object>> days = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate day = LocalDate.now().minusDays(i);
            var mgs = byDay.getOrDefault(day, List.of());
            long efectivas = mgs.stream()
                    .filter(m -> "EFECTIVA".equals(
                            m.getResultType()))
                    .count();
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("date",      day.toString());
            d.put("label",     day.getDayOfWeek().getDisplayName(java.time.format.TextStyle.SHORT,
                               new java.util.Locale("es","CO")));
            d.put("total",     mgs.size());
            d.put("efectivas", efectivas);
            d.put("metaOk",    efectivas >= META);
            days.add(d);
        }

        // Racha actual de días cumpliendo meta
        int streak = 0;
        for (int i = 0; i < 7; i++) {
            LocalDate day = LocalDate.now().minusDays(i);
            var mgs = byDay.getOrDefault(day, List.of());
            long ef = mgs.stream()
                    .filter(m -> "EFECTIVA".equals(
                            m.getResultType()))
                    .count();
            if (ef >= META) streak++;
            else if (i > 0) break; // solo rompe la racha si no es hoy
        }

        // Totales de la semana
        long totalSemana    = days.stream().mapToLong(d -> ((Number) d.get("total")).longValue()).sum();
        long efectivasSemana = days.stream().mapToLong(d -> ((Number) d.get("efectivas")).longValue()).sum();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("days",            days);
        result.put("streak",          streak);
        result.put("totalSemana",     totalSemana);
        result.put("efectivasSemana", efectivasSemana);
        result.put("metaSemana",      META * 5);
        return result;
    }

    // ── Cambio de contraseña ─────────────────────────────────────────────────

    @Transactional
    public void changePassword(String currentPassword, String newPassword) {
        Long userId = sessionContext.getCurrentUserId();
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new RuntimeException("Contraseña actual incorrecta");
        }
        if (newPassword.length() < 6) {
            throw new RuntimeException("La nueva contraseña debe tener al menos 6 caracteres");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // ── Notas personales ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getNotes() {
        Long userId = sessionContext.getCurrentUserId();
        return noteJpaRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(n -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",        n.getId());
                    m.put("content",   n.getContent());
                    m.put("updatedAt", n.getUpdatedAt().toString());
                    return m;
                }).toList();
    }

    @Transactional
    public Map<String, Object> saveNote(String content) {
        Long userId = sessionContext.getCurrentUserId();
        NoteEntity note = new NoteEntity();
        note.setUserId(userId);
        note.setContent(content);
        note.setCreatedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        var saved = noteJpaRepository.save(note);
        return Map.of("id", saved.getId(), "content", saved.getContent(),
                      "updatedAt", saved.getUpdatedAt().toString());
    }

    @Transactional
    public void updateNote(Long id, String content) {
        Long userId = sessionContext.getCurrentUserId();
        noteJpaRepository.findById(id).ifPresent(n -> {
            if (!n.getUserId().equals(userId)) throw new RuntimeException("Sin permiso");
            n.setContent(content);
            n.setUpdatedAt(LocalDateTime.now());
            noteJpaRepository.save(n);
        });
    }

    @Transactional
    public void deleteNote(Long id) {
        Long userId = sessionContext.getCurrentUserId();
        noteJpaRepository.findById(id).ifPresent(n -> {
            if (!n.getUserId().equals(userId)) throw new RuntimeException("Sin permiso");
            noteJpaRepository.delete(n);
        });
    }
}
