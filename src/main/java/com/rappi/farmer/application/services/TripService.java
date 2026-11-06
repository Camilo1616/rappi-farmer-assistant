package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.TripDayDto;
import com.rappi.farmer.application.dtos.TripDayDto.*;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Viajes del conductor. Cada viaje tiene lineas de INGRESO (fletes cobrados a otras fincas)
 * y de GASTO (ACPM, peajes, pago al conductor...). Una linea es un valor fijo o cajas x tarifa.
 * Las tarifas frecuentes ("presets") se editan en Ajustes para no digitarlas cada vez.
 */
@Service
@RequiredArgsConstructor
public class TripService {

    public static final String INCOME = "INCOME";
    public static final String EXPENSE = "EXPENSE";

    private final TripJpaRepository tripRepo;
    private final TripEntryJpaRepository entryRepo;
    private final RatePresetJpaRepository presetRepo;

    @Transactional(readOnly = true)
    public TripDayDto getDay(LocalDate date) {
        List<TripEntity> trips = tripRepo.findByDayOrderByIdAsc(date);
        Map<Long, List<TripEntryEntity>> entries = new HashMap<>();
        if (!trips.isEmpty()) {
            for (TripEntryEntity e : entryRepo.findByTripIdIn(trips.stream().map(TripEntity::getId).toList())) {
                entries.computeIfAbsent(e.getTripId(), k -> new ArrayList<>()).add(e);
            }
        }
        BigDecimal income = BigDecimal.ZERO, expense = BigDecimal.ZERO;
        List<TripDto> out = new ArrayList<>();
        for (TripEntity t : trips) {
            BigDecimal tIn = BigDecimal.ZERO, tEx = BigDecimal.ZERO;
            List<EntryDto> list = new ArrayList<>();
            for (TripEntryEntity e : entries.getOrDefault(t.getId(), List.of())) {
                list.add(new EntryDto(e.getId(), e.getType(), e.getConcept(), e.getBoxes(), e.getUnitAmount(), e.getAmount()));
                if (INCOME.equals(e.getType())) tIn = tIn.add(e.getAmount());
                else tEx = tEx.add(e.getAmount());
            }
            out.add(new TripDto(t.getId(), t.getDriverName(), t.getDestination(), t.getNotes(), list, tIn, tEx, tIn.subtract(tEx)));
            income = income.add(tIn);
            expense = expense.add(tEx);
        }
        return new TripDayDto(date, out, income, expense, income.subtract(expense), presets());
    }

    @Transactional
    public TripEntity createTrip(LocalDate date, String driver, String destination, String notes) {
        TripEntity t = new TripEntity();
        t.setDay(date);
        t.setDriverName(blankToNull(driver));
        t.setDestination(blankToNull(destination));
        t.setNotes(blankToNull(notes));
        return tripRepo.save(t);
    }

    @Transactional
    public void deleteTrip(Long tripId) {
        if (!tripRepo.existsById(tripId)) throw new BusinessException("Viaje no encontrado");
        entryRepo.deleteByTripId(tripId);
        tripRepo.deleteById(tripId);
    }

    @Transactional
    public void addEntry(Long tripId, String type, String concept, Integer boxes, BigDecimal unitAmount, BigDecimal amount) {
        if (!tripRepo.existsById(tripId)) throw new BusinessException("Viaje no encontrado");
        requireType(type);
        if (concept == null || concept.isBlank()) throw new BusinessException("El concepto es obligatorio");
        TripEntryEntity e = new TripEntryEntity();
        e.setTripId(tripId);
        e.setType(type);
        e.setConcept(concept.trim());
        e.setBoxes(boxes);
        e.setUnitAmount(unitAmount);
        e.setAmount(computeAmount(boxes, unitAmount, amount));
        entryRepo.save(e);
    }

    @Transactional
    public void deleteEntry(Long entryId) {
        if (!entryRepo.existsById(entryId)) throw new BusinessException("Línea no encontrada");
        entryRepo.deleteById(entryId);
    }

    /** Cajas x tarifa cuando se dan ambas; si no, el valor fijo (debe ser mayor a cero). */
    static BigDecimal computeAmount(Integer boxes, BigDecimal unitAmount, BigDecimal amount) {
        BigDecimal result;
        if (boxes != null && unitAmount != null) {
            if (boxes <= 0) throw new BusinessException("Las cajas deben ser mayor a cero");
            result = unitAmount.multiply(BigDecimal.valueOf(boxes));
        } else {
            result = amount;
        }
        if (result == null || result.signum() <= 0) throw new BusinessException("El valor debe ser mayor a cero");
        return result;
    }

    // ── Ajustes: tarifas frecuentes ──────────────────────────────────────────

    @Transactional
    public void savePreset(String kind, String concept, BigDecimal unitAmount, boolean perBox) {
        requireType(kind);
        if (concept == null || concept.isBlank()) throw new BusinessException("El concepto es obligatorio");
        if (unitAmount != null && unitAmount.signum() < 0) throw new BusinessException("La tarifa no puede ser negativa");
        RatePresetEntity p = presetRepo.findAllByOrderByKindAscConceptAsc().stream()
                .filter(x -> x.getKind().equals(kind) && x.getConcept().equalsIgnoreCase(concept.trim()))
                .findFirst().orElseGet(RatePresetEntity::new);
        p.setKind(kind);
        p.setConcept(concept.trim());
        p.setUnitAmount(unitAmount);
        p.setPerBox(perBox);
        presetRepo.save(p);
    }

    @Transactional
    public void deletePreset(Long id) {
        presetRepo.deleteById(id);
    }

    private List<PresetDto> presets() {
        return presetRepo.findAllByOrderByKindAscConceptAsc().stream()
                .map(p -> new PresetDto(p.getId(), p.getKind(), p.getConcept(), p.getUnitAmount(), Boolean.TRUE.equals(p.getPerBox())))
                .toList();
    }

    private static void requireType(String type) {
        if (!INCOME.equals(type) && !EXPENSE.equals(type)) throw new BusinessException("Tipo inválido");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
