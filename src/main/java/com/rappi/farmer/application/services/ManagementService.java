package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ManagementViewDto;
import com.rappi.farmer.application.dtos.RegisterManagementRequest;
import com.rappi.farmer.domain.entities.Management;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.infrastructure.config.SessionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ManagementService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final ManagementRepository managementRepository;
    private final SessionContext sessionContext;

    @Transactional
    public Management register(RegisterManagementRequest request) {
        Management management = new Management(
                null,
                request.getStoreId(),
                null,
                null,
                sessionContext.getCurrentUserId(),
                request.getManagementType(),
                request.getResultType(),
                request.getComments(),
                LocalDateTime.now()
        );
        Management saved = managementRepository.save(management);
        log.info("Gestión registrada — tienda:{} tipo:{} resultado:{}",
                request.getStoreId(), request.getManagementType(), request.getResultType());
        return saved;
    }

    @Transactional
    public Management update(Long managementId, String managementType, String resultType, String comments) {
        Management updated = managementRepository.update(managementId, managementType, resultType, comments);
        log.info("Gestión actualizada — id:{} tipo:{} resultado:{}", managementId, managementType, resultType);
        return updated;
    }

    public Optional<String> getTodayResultForStore(Long storeId) {
        return managementRepository.findLatestTodayByStoreId(storeId)
                .map(Management::getResultType);
    }

    public List<ManagementViewDto> getTodayManagements() {
        return managementRepository.findAllToday().stream()
                .map(this::toViewDto)
                .collect(Collectors.toList());
    }

    private ManagementViewDto toViewDto(Management m) {
        return new ManagementViewDto(
                m.getId(),
                m.getStoreName(),
                m.getStoreCode(),
                m.getManagementType(),
                m.getResultType(),
                m.getComments(),
                m.getManagementDate() != null ? m.getManagementDate().format(TIME_FMT) : ""
        );
    }
}
