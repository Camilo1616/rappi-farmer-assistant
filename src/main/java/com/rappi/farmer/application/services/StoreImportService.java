package com.rappi.farmer.application.services;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.dtos.ImportResultDto;
import com.rappi.farmer.application.dtos.StoreExcelRowDto;
import com.rappi.farmer.domain.entities.DailyMetric;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.domain.repositories.ManagementRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.domain.repositories.WhatsappMessageRepository;
import com.rappi.farmer.infrastructure.excel.ExcelReaderService;
import org.springframework.security.crypto.password.PasswordEncoder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class StoreImportService {

    private final ExcelReaderService excelReaderService;
    private final StoreRepository storeRepository;
    private final DailyMetricRepository dailyMetricRepository;
    private final ManagementRepository managementRepository;
    private final WhatsappMessageRepository whatsappMessageRepository;
    private final UserRepository userRepository;
    private final SessionContext sessionContext;
    private final PasswordEncoder encoder;

    // Cache email → userId para no consultar BD por cada fila (thread-safe)
    private final java.util.Map<String, Long> farmerEmailCache = new java.util.concurrent.ConcurrentHashMap<>();

    @Transactional
    public ImportResultDto importFromExcel(File file) throws IOException {
        List<StoreExcelRowDto> rows = excelReaderService.read(file);
        LocalDate today = LocalDate.now();
        farmerEmailCache.clear();

        String emailLogueado = sessionContext.getCurrentUserEmail() != null
                ? sessionContext.getCurrentUserEmail().toLowerCase().trim() : null;
        boolean esLider = sessionContext.getCurrentUserRole() != null
                && com.rappi.farmer.domain.enums.UserRole.LIDER == sessionContext.getCurrentUserRole();

        int created = 0, updated = 0, skipped = 0, errors = 0;

        for (StoreExcelRowDto row : rows) {
            try {
                String farmerEmail = row.getFarmerEmail() != null
                        ? row.getFarmerEmail().toLowerCase().trim() : null;

                // Sin email en la columna FARMER → ignorar siempre
                if (farmerEmail == null || farmerEmail.isBlank()) {
                    skipped++;
                    continue;
                }

                Long farmerId;
                if (esLider) {
                    // Líder: procesa todas las filas, asigna según la columna FARMER
                    farmerId = resolverFarmerPorEmail(farmerEmail);
                } else {
                    // Farmer: solo procesa filas donde FARMER = su propio email
                    if (!farmerEmail.equals(emailLogueado)) {
                        skipped++;
                        continue;
                    }
                    farmerId = sessionContext.getCurrentUserId();
                }

                if (farmerId == null) {
                    skipped++;
                    continue;
                }

                Store savedStore;
                Optional<Store> existing = storeRepository.findByStoreCode(row.getStoreCode());

                if (existing.isPresent()) {
                    updateStore(existing.get(), row, farmerId);
                    savedStore = storeRepository.save(existing.get());
                    updated++;
                } else {
                    savedStore = storeRepository.save(buildStore(row, farmerId));
                    created++;
                }

                saveDailyMetric(savedStore.getId(), row, today);

            } catch (Exception e) {
                log.error("Error importando tienda {}: {}", row.getStoreCode(), e.getMessage());
                errors++;
            }
        }

        log.info("Importación completa — total:{} creadas:{} actualizadas:{} ignoradas:{} errores:{}",
                rows.size(), created, updated, skipped, errors);

        return new ImportResultDto(rows.size(), created, updated, errors);
    }

    private void saveDailyMetric(Long storeId, StoreExcelRowDto row, LocalDate date) {
        Optional<DailyMetric> existing = dailyMetricRepository.findByStoreIdAndDate(storeId, date);

        DailyMetric metric = existing.orElseGet(DailyMetric::new);
        metric.setStoreId(storeId);
        metric.setMetricDate(date);
        metric.setOrdersCount(row.getOrdersL4W());
        metric.setConnectionPercentage(row.getConnectionPercentage());
        metric.setAvaL7d(row.getAvaL7d());
        metric.setAvaStatus(row.getAvaStatus());
        metric.setRappiAlliesConnected(parseAvaStatus(row.getAvaStatus()));

        dailyMetricRepository.save(metric);
    }

    private Boolean parseAvaStatus(String avaStatus) {
        if (avaStatus == null || avaStatus.isBlank()) return null;
        return !avaStatus.toLowerCase().contains("inact");
    }

    private Store buildStore(StoreExcelRowDto row, Long farmerId) {
        LocalDate handoffActivatedAt = calcularHandoffActivatedAt(
                row.getChannel(), row.getHadHandoff(), row.getOnboardingDate(), null, null);
        Store s = new Store(null, row.getStoreCode(), row.getBrandId(), row.getStoreName(),
                row.getPhoneNumber(), row.getChannel(), row.getOnboardingDate(),
                true, row.getConnectionPercentage(), row.getCurrentStatus(),
                row.getHadHandoff(), handoffActivatedAt, farmerId, row.getAging());
        return s;
    }

    private void updateStore(Store store, StoreExcelRowDto row, Long farmerId) {
        store.setStoreName(row.getStoreName());
        if (row.getBrandId() != null) store.setBrandId(row.getBrandId());
        store.setPhoneNumber(row.getPhoneNumber());
        store.setChannel(row.getChannel());
        store.setConnectionPercentage(row.getConnectionPercentage());
        store.setCurrentStatus(row.getCurrentStatus());
        store.setAging(row.getAging());
        if (row.getOnboardingDate() != null) store.setOnboardingDate(row.getOnboardingDate());
        if (farmerId != null) store.setFarmerId(farmerId);

        boolean anteriorSinHandoff = !Boolean.TRUE.equals(store.getHadHandoff());
        boolean nuevoConHandoff    = Boolean.TRUE.equals(row.getHadHandoff());
        store.setHadHandoff(row.getHadHandoff());

        LocalDate nuevaFecha = calcularHandoffActivatedAt(
                row.getChannel(), row.getHadHandoff(),
                row.getOnboardingDate() != null ? row.getOnboardingDate() : store.getOnboardingDate(),
                store.getHandoffActivatedAt(),
                anteriorSinHandoff && nuevoConHandoff);
        if (nuevaFecha != null && store.getHandoffActivatedAt() == null) {
            store.setHandoffActivatedAt(nuevaFecha);
        }
    }

    /**
     * Reglas por canal:
     *  - Self              → día 1 desde onboarding_date (no necesita HO)
     *  - Hunting / Inside  → solo si hay HO confirmado (hadHandoff=true, flip NO→SÍ)
     */
    private LocalDate calcularHandoffActivatedAt(String channel, Boolean hadHandoff,
            LocalDate onboardingDate, LocalDate existing, Boolean flipHandoff) {
        if (existing != null) return null; // ya tiene fecha, no sobreescribir
        String ch = channel != null ? channel.toLowerCase().trim() : "";
        if (ch.contains("self")) {
            // Self: empieza el día de onboarding
            return onboardingDate != null ? onboardingDate : LocalDate.now();
        }
        // Hunting / Inside Sales: solo si HO está confirmado
        if (Boolean.TRUE.equals(hadHandoff)) {
            // Flip detectado en esta carga → hoy es día 1
            if (Boolean.TRUE.equals(flipHandoff)) return LocalDate.now();
            // Ya tenía HO desde antes → usar onboarding como aproximación
            return onboardingDate != null ? onboardingDate : LocalDate.now();
        }
        return null; // Hunting/Inside sin HO → no activa el ciclo aún
    }

    @Transactional
    public int clearStores(Long userId, UserRole role, List<Long> farmerIds) {
        List<Store> stores;
        if (UserRole.ADMIN == role) {
            stores = storeRepository.findAll();
        } else if (UserRole.LIDER == role) {
            stores = farmerIds.isEmpty()
                    ? storeRepository.findByUserId(userId)
                    : farmerIds.stream()
                            .flatMap(fid -> storeRepository.findByUserId(fid).stream())
                            .toList();
        } else {
            stores = storeRepository.findByUserId(userId);
        }
        for (Store s : stores) {
            managementRepository.deleteByStoreId(s.getId());
            whatsappMessageRepository.deleteByStoreId(s.getId());
            dailyMetricRepository.deleteByStoreId(s.getId());
            storeRepository.deleteById(s.getId());
        }
        log.info("Cartera limpiada — {} tiendas eliminadas (userId:{} role:{})", stores.size(), userId, role);
        return stores.size();
    }

    /**
     * Busca el usuario por email en caché o BD.
     * Si no existe, lo crea automáticamente como FARMER_MASS.
     */
    private Long resolverFarmerPorEmail(String email) {
        return farmerEmailCache.computeIfAbsent(email, k -> {
            Optional<User> user = userRepository.findByEmail(k);
            if (user.isPresent()) {
                return user.get().getId();
            }
            // Auto-crear si el correo está en el Excel pero no tiene cuenta aún
            try {
                String localPart = k.contains("@") ? k.substring(0, k.indexOf('@')) : k;
                String nombre = java.util.Arrays.stream(localPart.split("[._]"))
                        .map(p -> p.isEmpty() ? "" : Character.toUpperCase(p.charAt(0)) + p.substring(1))
                        .collect(java.util.stream.Collectors.joining(" "));
                Long liderId = sessionContext.getCurrentUserId();
                User nuevo = new User(null, nombre, k, "FARMER_MASS",
                        encoder.encode("rappi2025"), null, "CO", "ACTIVE", liderId, null, null, null);
                User guardado = userRepository.save(nuevo);
                log.info("Farmer auto-registrado desde Excel: {} ({})", nombre, k);
                return guardado.getId();
            } catch (Exception e) {
                log.warn("No se pudo auto-registrar farmer {}: {}", k, e.getMessage());
                return null;
            }
        });
    }
}
