package com.rappi.farmer.application.services;

import com.rappi.farmer.application.SessionContext;
import com.rappi.farmer.application.dtos.ImportResultDto;
import com.rappi.farmer.application.dtos.StoreExcelRowDto;
import com.rappi.farmer.domain.entities.Store;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.infrastructure.excel.ExcelReaderService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreImportServiceTest {

    @Mock private ExcelReaderService excelReaderService;
    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private SessionContext sessionContext;
    @Mock private EntityManager entityManager;

    @InjectMocks
    private StoreImportService storeImportService;

    private static final String FARMER_EMAIL = "farmer@rappi.com";
    private static final Long   FARMER_ID    = 1L;

    @Test
    void importFromExcel_createsStoresCuandoNoExisten() throws IOException {
        File file = new File("cartera.xlsx");
        StoreExcelRowDto row = StoreExcelRowDto.builder()
                .storeCode("CO-001")
                .storeName("Restaurante Ejemplo")
                .phoneNumber("3001234567")
                .channel("DIGITAL")
                .farmerEmail(FARMER_EMAIL)
                .build();

        User farmer = new User(FARMER_ID, "Farmer", FARMER_EMAIL, "FARMER_MASS",
                "pass", null, "CO", "ACTIVE", null, null, null, null, null, null);
        when(excelReaderService.read(file)).thenReturn(List.of(row));
        when(userRepository.findByEmail(FARMER_EMAIL)).thenReturn(Optional.of(farmer));
        when(storeRepository.findByStoreCode("CO-001")).thenReturn(Optional.empty());
        when(storeRepository.save(any())).thenAnswer(inv -> {
            Store s = inv.getArgument(0);
            if (s.getId() == null) {
                // simular ID asignado por BD
                return new Store(1L, s.getStoreCode(), s.getBrandId(), s.getStoreName(),
                        s.getPhoneNumber(), s.getChannel(), s.getOnboardingDate(), s.getActive(),
                        s.getConnectionPercentage(), s.getCurrentStatus(), s.getHadHandoff(),
                        s.getHandoffActivatedAt(), s.getFarmerId(), s.getAging(), s.getAgingStage(),
                        s.getLastLoginDate(), s.getGestionar(), s.getUploadDate(), s.getFarmerEmail(),
                        s.getCredentialsDate());
            }
            return s;
        });
        when(userRepository.findById(any())).thenReturn(Optional.of(farmer));

        ImportResultDto result = storeImportService.importFromExcel(file);

        assertThat(result.getTotal()).isEqualTo(1);
        assertThat(result.getCreated()).isEqualTo(1);
        assertThat(result.getUpdated()).isEqualTo(0);
        assertThat(result.getErrors()).isEqualTo(0);
    }

    @Test
    void importFromExcel_actualizaStoresQueYaExisten() throws IOException {
        File file = new File("cartera.xlsx");
        StoreExcelRowDto row = StoreExcelRowDto.builder()
                .storeCode("CO-001")
                .storeName("Nombre Actualizado")
                .phoneNumber("3009999999")
                .channel("DIGITAL")
                .farmerEmail(FARMER_EMAIL)
                .build();

        Store existing = new Store(1L, "CO-001", null, "Nombre Viejo", "3000000000",
                "DIGITAL", null, true, null, null, null, null, FARMER_ID, null, null, null, null, null, null, null);
        User farmer = new User(FARMER_ID, "Farmer", FARMER_EMAIL, "FARMER_MASS",
                "pass", null, "CO", "ACTIVE", null, null, null, null, null, null);

        when(excelReaderService.read(file)).thenReturn(List.of(row));
        when(userRepository.findByEmail(FARMER_EMAIL)).thenReturn(Optional.of(farmer));
        when(storeRepository.findByStoreCode("CO-001")).thenReturn(Optional.of(existing));
        when(storeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(any())).thenReturn(Optional.of(farmer));

        ImportResultDto result = storeImportService.importFromExcel(file);

        assertThat(result.getUpdated()).isEqualTo(1);
        assertThat(result.getCreated()).isEqualTo(0);
        assertThat(result.getErrors()).isEqualTo(0);
    }

    @Test
    void importFromExcel_cuentaErroresSinDetenerImportacion() throws IOException {
        File file = new File("cartera.xlsx");
        StoreExcelRowDto row1 = StoreExcelRowDto.builder().storeCode("CO-001").storeName("Tienda 1").farmerEmail(FARMER_EMAIL).build();
        StoreExcelRowDto row2 = StoreExcelRowDto.builder().storeCode("CO-002").storeName("Tienda 2").farmerEmail(FARMER_EMAIL).build();

        User farmer = new User(FARMER_ID, "Farmer", FARMER_EMAIL, "FARMER_MASS",
                "pass", null, "CO", "ACTIVE", null, null, null, null, null, null);

        when(excelReaderService.read(file)).thenReturn(List.of(row1, row2));
        when(userRepository.findByEmail(FARMER_EMAIL)).thenReturn(Optional.of(farmer));
        when(storeRepository.findByStoreCode("CO-001")).thenThrow(new RuntimeException("Error BD"));
        when(storeRepository.findByStoreCode("CO-002")).thenReturn(Optional.empty());
        when(storeRepository.save(any())).thenAnswer(inv -> {
            Store s = inv.getArgument(0);
            return new Store(2L, s.getStoreCode(), s.getBrandId(), s.getStoreName(),
                    s.getPhoneNumber(), s.getChannel(), s.getOnboardingDate(), s.getActive(),
                    s.getConnectionPercentage(), s.getCurrentStatus(), s.getHadHandoff(),
                    s.getHandoffActivatedAt(), s.getFarmerId(), s.getAging(), s.getAgingStage(),
                    s.getLastLoginDate(), s.getGestionar(), s.getUploadDate(), s.getFarmerEmail(),
                    s.getCredentialsDate());
        });
        when(userRepository.findById(any())).thenReturn(Optional.of(farmer));

        ImportResultDto result = storeImportService.importFromExcel(file);

        assertThat(result.getErrors()).isEqualTo(1);
        assertThat(result.getCreated()).isEqualTo(1);
        assertThat(result.getTotal()).isEqualTo(2);
    }
}
