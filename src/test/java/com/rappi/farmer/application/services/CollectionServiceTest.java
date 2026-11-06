package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.CollectionRunDto;
import com.rappi.farmer.application.dtos.PortfolioDto;
import com.rappi.farmer.application.dtos.PortfolioDto.*;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CollectionServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 5);

    private CollectionRunJpaRepository runRepo;
    private CollectionItemJpaRepository itemRepo;
    private ClientPaymentJpaRepository paymentRepo;
    private PackagingReturnJpaRepository packagingRepo;
    private DispatchClientJpaRepository clientRepo;
    private DispatchSectorJpaRepository sectorRepo;
    private TripEntryJpaRepository tripEntryRepo;
    private PortfolioService portfolio;
    private PackagingService packaging;
    private CollectionService service;

    private static BigDecimal bd(String s) {
        return new BigDecimal(s);
    }

    private static ClientBalanceDto client(long id, String name, String balance) {
        return new ClientBalanceDto(id, name, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, bd(balance), List.of());
    }

    @BeforeEach
    void setUp() {
        runRepo = mock(CollectionRunJpaRepository.class);
        itemRepo = mock(CollectionItemJpaRepository.class);
        paymentRepo = mock(ClientPaymentJpaRepository.class);
        packagingRepo = mock(PackagingReturnJpaRepository.class);
        clientRepo = mock(DispatchClientJpaRepository.class);
        sectorRepo = mock(DispatchSectorJpaRepository.class);
        tripEntryRepo = mock(TripEntryJpaRepository.class);
        portfolio = mock(PortfolioService.class);
        packaging = mock(PackagingService.class);
        service = new CollectionService(runRepo, itemRepo, paymentRepo, packagingRepo, clientRepo, sectorRepo,
                tripEntryRepo, portfolio, packaging);
        when(runRepo.save(any())).thenAnswer(i -> {
            CollectionRunEntity r = i.getArgument(0);
            if (r.getId() == null) r.setId(1L);
            return r;
        });
        when(portfolio.getPortfolio(DAY)).thenReturn(new PortfolioDto(DAY, List.of(
                new SectorBalanceDto(1L, "Mercasa", List.of(client(1, "Arango", "210000"), client(2, "Marina", "0"),
                        client(3, "Lorena", "0")), BigDecimal.ZERO)), null));
        when(packaging.balances(DAY)).thenReturn(Map.of(1L, 0, 2L, 0, 3L, 4));
    }

    @Test
    void sectorRunIncludesOnlyClientsWhoOweMoneyOrEmpties() {
        service.createRun(DAY, "Oscar", "Pereira", null, List.of(1L), List.of());
        ArgumentCaptor<CollectionItemEntity> cap = ArgumentCaptor.forClass(CollectionItemEntity.class);
        verify(itemRepo, times(2)).save(cap.capture());
        List<Long> ids = cap.getAllValues().stream().map(CollectionItemEntity::getClientId).toList();
        assertTrue(ids.contains(1L));   // debe plata
        assertTrue(ids.contains(3L));   // debe vacias
        assertFalse(ids.contains(2L));  // al dia
        assertEquals(0, bd("210000").compareTo(cap.getAllValues().stream()
                .filter(i -> i.getClientId() == 1L).findFirst().orElseThrow().getOwedSnapshot()));
    }

    @Test
    void emptySelectionIsRejected() {
        assertThrows(BusinessException.class, () -> service.createRun(DAY, null, null, null, List.of(), List.of()));
    }

    private void item(long itemId, long clientId, String owed) {
        CollectionItemEntity it = new CollectionItemEntity();
        it.setId(itemId);
        it.setRunId(1L);
        it.setClientId(clientId);
        it.setOwedSnapshot(bd(owed));
        CollectionRunEntity run = new CollectionRunEntity();
        run.setId(1L);
        run.setDay(DAY);
        when(itemRepo.findById(itemId)).thenReturn(Optional.of(it));
        when(runRepo.findById(1L)).thenReturn(Optional.of(run));
    }

    @Test
    void cashAndNequiAreAbonosAndDepositIsConsignacion() {
        item(10, 1, "660000");
        service.collect(10L, bd("384000"), "EFECTIVO", "Conductor", null, null);
        service.collect(10L, bd("276000"), "NEQUI", "Angela", null, null);
        service.collect(10L, bd("1000"), "CONSIGNACION", null, null, null);
        ArgumentCaptor<ClientPaymentEntity> cap = ArgumentCaptor.forClass(ClientPaymentEntity.class);
        verify(paymentRepo, times(3)).save(cap.capture());
        assertEquals(List.of("ABONO", "ABONO", "CONSIGNACION"), cap.getAllValues().stream().map(ClientPaymentEntity::getType).toList());
        assertEquals("NEQUI", cap.getAllValues().get(1).getMethod());
        assertEquals(1L, cap.getAllValues().get(0).getRunId());
    }

    @Test
    void collectNeedsAnAmountOrEmptiesAndAValidMethod() {
        item(10, 1, "660000");
        assertThrows(BusinessException.class, () -> service.collect(10L, null, null, null, null, null));
        assertThrows(BusinessException.class, () -> service.collect(10L, bd("5000"), "TRUEQUE", null, null, null));
        service.collect(10L, null, null, null, null, 7); // solo vacias
        verify(packagingRepo).save(any());
        verify(paymentRepo, never()).save(any());
    }

    @Test
    void partialPaymentNeedsClarificationUntilResolved() {
        item(10, 1, "210000");
        ClientPaymentEntity p = new ClientPaymentEntity();
        p.setId(5L);
        p.setClientId(1L);
        p.setType("ABONO");
        p.setMethod("EFECTIVO");
        p.setAmount(bd("100000"));
        when(paymentRepo.findByRunId(1L)).thenReturn(List.of(p));
        CollectionItemEntity theItem = itemRepo.findById(10L).orElseThrow();
        CollectionRunEntity theRun = runRepo.findById(1L).orElseThrow();
        when(itemRepo.findByRunId(1L)).thenReturn(List.of(theItem));
        when(runRepo.findByDayOrderByIdAsc(DAY)).thenReturn(List.of(theRun));
        DispatchClientEntity c = new DispatchClientEntity();
        c.setId(1L);
        c.setName("Arango");
        c.setSectorId(1L);
        when(clientRepo.findAllById(any())).thenReturn(List.of(c));

        CollectionRunDto.ItemDto it = service.getDay(DAY).get(0).items().get(0);
        assertEquals("PARCIAL", it.status());
        assertEquals(0, bd("110000").compareTo(it.remaining()));
        assertTrue(it.needsClarification());
    }

    @Test
    void discountAndMissingStrawberriesLowerTheBalanceButCannotExceedWhatIsMissing() {
        item(10, 1, "210000");
        ClientPaymentEntity paid = new ClientPaymentEntity();
        paid.setClientId(1L);
        paid.setAmount(bd("100000"));
        when(paymentRepo.findByRunId(1L)).thenReturn(List.of(paid));

        assertThrows(BusinessException.class, () -> service.resolve(10L, "DESCUENTO", bd("110001"), null));
        service.resolve(10L, "FALTANTE", bd("110000"), "No llego completa");
        ArgumentCaptor<ClientPaymentEntity> cap = ArgumentCaptor.forClass(ClientPaymentEntity.class);
        verify(paymentRepo).save(cap.capture());
        assertEquals("FALTANTE", cap.getValue().getType());
        verify(itemRepo).save(argThat(i -> "FALTANTE".equals(i.getResolution())));
    }

    @Test
    void leavingItAsDebtCreatesNoMovement() {
        item(10, 1, "210000");
        service.resolve(10L, "DEBE", null, null);
        verify(paymentRepo, never()).save(any());
        verify(itemRepo).save(argThat(i -> "DEBE".equals(i.getResolution())));
    }

    @Test
    void cashToHandOverIsCashCollectedMinusTripExpenses() {
        CollectionRunEntity run = new CollectionRunEntity();
        run.setId(1L);
        run.setDay(DAY);
        run.setTripId(9L);
        run.setHandedAmount(bd("400000"));
        run.setHandedTo("Angela");
        when(runRepo.findByDayOrderByIdAsc(DAY)).thenReturn(List.of(run));
        when(itemRepo.findByRunId(1L)).thenReturn(List.of());
        ClientPaymentEntity cash = new ClientPaymentEntity();
        cash.setClientId(1L);
        cash.setType("ABONO");
        cash.setMethod("EFECTIVO");
        cash.setAmount(bd("1000000"));
        ClientPaymentEntity nequi = new ClientPaymentEntity();
        nequi.setClientId(2L);
        nequi.setType("ABONO");
        nequi.setMethod("NEQUI");
        nequi.setAmount(bd("500000"));
        when(paymentRepo.findByRunId(1L)).thenReturn(List.of(cash, nequi));
        TripEntryEntity gas = new TripEntryEntity();
        gas.setType("EXPENSE");
        gas.setAmount(bd("298000"));
        when(tripEntryRepo.findByTripIdIn(List.of(9L))).thenReturn(List.of(gas));

        CollectionRunDto.HandoverDto h = service.getDay(DAY).get(0).handover();
        assertEquals(0, bd("1000000").compareTo(h.cash()));            // Nequi no es efectivo
        assertEquals(0, bd("702000").compareTo(h.cashExpected()));     // 1.000.000 - 298.000
        assertEquals(0, bd("-302000").compareTo(h.difference()));      // entrego 400.000: faltan 302.000
    }

    @Test
    void handoverRequiresRecipientAndValidAmount() {
        CollectionRunEntity run = new CollectionRunEntity();
        run.setId(1L);
        run.setDay(DAY);
        when(runRepo.findById(1L)).thenReturn(Optional.of(run));
        assertThrows(BusinessException.class, () -> service.handover(1L, bd("1"), " "));
        assertThrows(BusinessException.class, () -> service.handover(1L, bd("-1"), "Angela"));
        service.handover(1L, bd("500"), "Angela");
        assertTrue(run.getClosed());
    }

    @Test
    void onlyRunPaymentsCanBeRemovedFromARun() {
        ClientPaymentEntity loose = new ClientPaymentEntity();
        loose.setId(3L);
        when(paymentRepo.findById(3L)).thenReturn(Optional.of(loose));
        assertThrows(BusinessException.class, () -> service.deletePayment(3L));
    }
}
