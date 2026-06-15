package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.FarmerSummaryDto;
import com.rappi.farmer.application.dtos.ManagementViewDto;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.infrastructure.persistence.repository.ManagementJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private static final BigDecimal ALIADOS_THRESHOLD = BigDecimal.valueOf(60);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final UserService userService;
    private final ManagementJpaRepository managementJpaRepository;
    private final StoreRepository storeRepository;
    private final com.rappi.farmer.application.SessionContext sessionContext;

    /** Retorna los Farmer Mass asignados al LIDER logueado. */
    public List<FarmerSummaryDto> getAllFarmers() {
        Long liderId = sessionContext.getCurrentUserId();
        List<User> farmers = liderId != null ? userService.findFarmersByLider(liderId) : List.of();
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        return farmers.stream().map(f -> buildSummary(f, start, end)).collect(Collectors.toList());
    }

    /** Retorna las gestiones del día de un farmer específico. */
    public List<ManagementViewDto> getFarmerTodayManagements(Long userId) {
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        return managementJpaRepository.findTodayByUserId(userId, start, end)
                .stream()
                .map(m -> new ManagementViewDto(
                        m.getId(),
                        m.getUser() != null ? m.getUser().getId() : userId,
                        m.getStore().getStoreName(),
                        m.getStore().getStoreCode(),
                        m.getManagementType(),
                        m.getResultType(),
                        m.getComments(),
                        m.getManagementDate() != null
                                ? m.getManagementDate().format(TIME_FMT) : "",
                        m.getUser() != null ? m.getUser().getFullName() : null,
                        m.getUser() != null ? m.getUser().getFarmerCode() : null,
                        m.getStore() != null ? m.getStore().getHadHandoff() : null,
                        m.isBrandSync()))
                .collect(Collectors.toList());
    }

    /** Retorna resumen de cartera de un farmer. */
    public FarmerSummaryDto getFarmerDetail(Long userId) {
        User farmer = userService.findAll().stream()
                .filter(u -> u.getId().equals(userId)).findFirst()
                .orElseThrow();
        LocalDateTime start = LocalDate.now().atStartOfDay();
        return buildSummary(farmer, start, start.plusDays(1));
    }

    private FarmerSummaryDto buildSummary(User f, LocalDateTime start, LocalDateTime end) {
        long gestiones  = f.getId() != null ? managementJpaRepository.countTodayByUserId(f.getId(), start, end) : 0;
        long exitosas   = f.getId() != null ? managementJpaRepository.countTodayByUserIdAndResult(f.getId(), "EFECTIVA", start, end) : 0;
        long noContacto = f.getId() != null ? managementJpaRepository.countTodayByUserIdAndResult(f.getId(), "NO_CONTACTO", start, end) : 0;
        long total      = f.getId() != null ? storeRepository.countActiveByUserId(f.getId()) : 0;

        List<Store> stores = f.getId() != null
                ? storeRepository.findActiveByUser(f.getId())
                : List.of();

        long onboarding = stores.stream().filter(this::isOnboarding).count();
        long churn      = stores.stream().filter(this::isChurn).count();
        long saludables = stores.stream().filter(s -> !isOnboarding(s) && !isChurn(s)).count();

        return new FarmerSummaryDto(
                f.getId(),
                f.getFarmerCode() != null ? f.getFarmerCode() : "—",
                f.getFullName(),
                f.getEmail(),
                f.getCountryCode() != null ? f.getCountryCode() : "—",
                f.getAccountStatus() != null ? f.getAccountStatus() : "ACTIVE",
                gestiones, exitosas, noContacto,
                total, onboarding, churn, saludables);
    }

    private boolean isOnboarding(Store s) {
        boolean isSelf = s.getChannel() != null && s.getChannel().toLowerCase().contains("self");
        if (isSelf) return false;
        java.time.LocalDate ref = s.getHandoffActivatedAt() != null
                ? s.getHandoffActivatedAt() : s.getOnboardingDate();
        if (ref == null) return false;
        long aging = java.time.temporal.ChronoUnit.DAYS.between(ref, LocalDate.now());
        return aging >= 1 && aging <= 8;
    }

    private boolean isChurn(Store s) {
        String status = s.getCurrentStatus();
        if (status == null) return false;
        String st = status.trim().toUpperCase();
        return st.contains("M1") || st.contains("M2") || st.equals("CHURN");
    }
}
