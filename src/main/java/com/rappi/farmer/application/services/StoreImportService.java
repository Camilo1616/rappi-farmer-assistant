package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ImportResultDto;
import com.rappi.farmer.application.dtos.StoreExcelRowDto;
import com.rappi.farmer.domain.entities.DailyMetric;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.repositories.DailyMetricRepository;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.infrastructure.excel.ExcelReaderService;
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

    @Transactional
    public ImportResultDto importFromExcel(File file) throws IOException {
        List<StoreExcelRowDto> rows = excelReaderService.read(file);
        LocalDate today = LocalDate.now();

        int created = 0, updated = 0, errors = 0;

        for (StoreExcelRowDto row : rows) {
            try {
                Store savedStore;
                Optional<Store> existing = storeRepository.findByStoreCode(row.getStoreCode());

                if (existing.isPresent()) {
                    updateStore(existing.get(), row);
                    savedStore = storeRepository.save(existing.get());
                    updated++;
                } else {
                    savedStore = storeRepository.save(buildStore(row));
                    created++;
                }

                saveDailyMetric(savedStore.getId(), row, today);

            } catch (Exception e) {
                log.error("Error importando tienda {}: {}", row.getStoreCode(), e.getMessage());
                errors++;
            }
        }

        log.info("Importación completa — total: {}, creadas: {}, actualizadas: {}, errores: {}",
                rows.size(), created, updated, errors);

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

    private Store buildStore(StoreExcelRowDto row) {
        return new Store(null, row.getStoreCode(), row.getStoreName(),
                row.getPhoneNumber(), row.getChannel(), row.getOnboardingDate(),
                true, row.getConnectionPercentage(), row.getCurrentStatus(), row.getHadHandoff());
    }

    private void updateStore(Store store, StoreExcelRowDto row) {
        store.setStoreName(row.getStoreName());
        store.setPhoneNumber(row.getPhoneNumber());
        store.setChannel(row.getChannel());
        store.setConnectionPercentage(row.getConnectionPercentage());
        store.setCurrentStatus(row.getCurrentStatus());
        store.setHadHandoff(row.getHadHandoff());
        if (row.getOnboardingDate() != null) {
            store.setOnboardingDate(row.getOnboardingDate());
        }
    }
}
