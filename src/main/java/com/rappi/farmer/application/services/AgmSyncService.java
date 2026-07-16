package com.rappi.farmer.application.services;

import com.rappi.farmer.infrastructure.persistence.entity.AgmSeenRowEntity;
import com.rappi.farmer.infrastructure.persistence.repository.AgmSeenRowJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Revisa periódicamente el sheet de AGM IA en busca de filas pendientes nuevas (no vistas antes)
 * y avisa por WebSocket al agente asignado, para que no tenga que entrar manualmente a revisar.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgmSyncService {

    private final GoogleSheetsService googleSheetsService;
    private final AgmSeenRowJpaRepository seenRowRepository;
    private final RealtimeService realtimeService;

    @Scheduled(fixedDelay = 2 * 60 * 60 * 1000)
    @Transactional
    public void syncNewTasks() {
        if (!googleSheetsService.isConnected()) {
            return;
        }

        List<GoogleSheetsService.FilaPendiente> pendientes;
        try {
            pendientes = googleSheetsService.getFilasPendientes();
        } catch (Exception e) {
            log.warn("Error leyendo el sheet AGM IA durante el sync: {}", e.getMessage());
            return;
        }

        Set<Integer> yaVistas = seenRowRepository.findAllRowNumbers();
        List<GoogleSheetsService.FilaPendiente> nuevas = pendientes.stream()
                .filter(f -> !yaVistas.contains(f.rowNumber()))
                .toList();

        if (nuevas.isEmpty()) {
            return;
        }

        LocalDateTime ahora = LocalDateTime.now();
        for (GoogleSheetsService.FilaPendiente fila : nuevas) {
            AgmSeenRowEntity seen = new AgmSeenRowEntity();
            seen.setStoreId(fila.storeId());
            seen.setRowNumber(fila.rowNumber());
            seen.setFirstSeenAt(ahora);
            seenRowRepository.save(seen);
        }

        var nuevasPorAgente = nuevas.stream()
                .filter(f -> f.agenteAsignado() != null && !f.agenteAsignado().isBlank())
                .collect(Collectors.groupingBy(f -> f.agenteAsignado().trim(), Collectors.counting()));

        nuevasPorAgente.forEach((agente, count) -> realtimeService.agmNewTasks(agente, count.intValue()));

        log.info("Sync AGM IA — {} filas nuevas detectadas, {} agentes notificados",
                nuevas.size(), nuevasPorAgente.size());
    }
}
