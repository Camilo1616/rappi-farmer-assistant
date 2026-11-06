package com.rappi.farmer.application.services;

import com.rappi.farmer.infrastructure.persistence.repository.DispatchClientJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.DispatchLineJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.PackagingReturnJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * Empaque (cajas vacias) que debe cada cliente:
 * saldo inicial + cajas entregadas con fresa (sin bolsas) - vacias devueltas.
 */
@Service
@RequiredArgsConstructor
public class PackagingService {

    private final DispatchClientJpaRepository clientRepo;
    private final DispatchLineJpaRepository lineRepo;
    private final PackagingReturnJpaRepository returnRepo;

    @Transactional(readOnly = true)
    public Map<Long, Integer> balances(LocalDate upTo) {
        Map<Long, Integer> m = new HashMap<>();
        clientRepo.findAll().forEach(c -> m.put(c.getId(), c.getOpeningPackaging() == null ? 0 : c.getOpeningPackaging()));
        for (Object[] r : lineRepo.returnableBoxesUpTo(upTo)) m.merge((Long) r[0], ((Number) r[1]).intValue(), Integer::sum);
        for (Object[] r : returnRepo.sumByClientUpTo(upTo)) m.merge((Long) r[0], -((Number) r[1]).intValue(), Integer::sum);
        return m;
    }
}
