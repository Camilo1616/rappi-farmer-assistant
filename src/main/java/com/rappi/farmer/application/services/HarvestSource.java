package com.rappi.farmer.application.services;

import com.rappi.farmer.infrastructure.persistence.repository.CropIntakeJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.HarvestJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Fuente unica de "fresa que entra": suma la cosecha manual y las entradas de cultivos.
 * Asi el stock, el despacho y los reportes no se enteran de donde vino cada caja.
 */
@Component
@RequiredArgsConstructor
public class HarvestSource {

    private final HarvestJpaRepository harvestRepo;
    private final CropIntakeJpaRepository intakeRepo;

    /** [categoria, cajas] acumuladas hasta el dia (inclusive). */
    public List<Object[]> sumUpTo(LocalDate day) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Object[] r : harvestRepo.sumUpTo(day)) m.merge((String) r[0], ((Number) r[1]).longValue(), Long::sum);
        for (Object[] r : intakeRepo.sumUpTo(day)) m.merge((String) r[0], ((Number) r[1]).longValue(), Long::sum);
        List<Object[]> out = new ArrayList<>();
        m.forEach((k, v) -> out.add(new Object[]{k, v}));
        return out;
    }

    /** [dia, categoria, cajas] dentro del rango. */
    public List<Object[]> sumByDay(LocalDate from, LocalDate to) {
        Map<String, Object[]> m = new LinkedHashMap<>();
        for (List<Object[]> rows : List.of(harvestRepo.sumByDay(from, to), intakeRepo.sumByDay(from, to))) {
            for (Object[] r : rows) {
                String key = r[0] + "|" + r[1];
                Object[] cur = m.get(key);
                long n = ((Number) r[2]).longValue();
                if (cur == null) m.put(key, new Object[]{r[0], r[1], n});
                else cur[2] = ((Number) cur[2]).longValue() + n;
            }
        }
        return new ArrayList<>(m.values());
    }
}
