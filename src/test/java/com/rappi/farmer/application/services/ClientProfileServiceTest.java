package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ClientProfileDto;
import com.rappi.farmer.application.dtos.PortfolioDto;
import com.rappi.farmer.application.dtos.PortfolioDto.*;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClientProfileServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 20);

    private DispatchClientJpaRepository clientRepo;
    private DispatchSectorJpaRepository sectorRepo;
    private DispatchLineJpaRepository lineRepo;
    private ClientPaymentJpaRepository paymentRepo;
    private PackagingReturnJpaRepository packagingRepo;
    private ClientNoteJpaRepository noteRepo;
    private PortfolioService portfolio;
    private PackagingService packaging;
    private ClientProfileService service;

    private static BigDecimal bd(String s) {
        return new BigDecimal(s);
    }

    private static ClientPaymentEntity payment(String type, LocalDate day, String amount, String method, String by) {
        ClientPaymentEntity p = new ClientPaymentEntity();
        p.setClientId(7L);
        p.setType(type);
        p.setDay(day);
        p.setAmount(bd(amount));
        p.setMethod(method);
        p.setReceivedBy(by);
        return p;
    }

    @BeforeEach
    void setUp() {
        clientRepo = mock(DispatchClientJpaRepository.class);
        sectorRepo = mock(DispatchSectorJpaRepository.class);
        lineRepo = mock(DispatchLineJpaRepository.class);
        paymentRepo = mock(ClientPaymentJpaRepository.class);
        packagingRepo = mock(PackagingReturnJpaRepository.class);
        noteRepo = mock(ClientNoteJpaRepository.class);
        portfolio = mock(PortfolioService.class);
        packaging = mock(PackagingService.class);
        service = new ClientProfileService(clientRepo, sectorRepo, lineRepo, paymentRepo, packagingRepo, noteRepo,
                portfolio, packaging);

        DispatchClientEntity c = new DispatchClientEntity();
        c.setId(7L);
        c.setName("Marina");
        c.setSectorId(1L);
        c.setPhone("3001234567");
        when(clientRepo.findById(7L)).thenReturn(Optional.of(c));
        DispatchSectorEntity s = new DispatchSectorEntity();
        s.setId(1L);
        s.setName("Pereira Mercasa");
        when(sectorRepo.findById(1L)).thenReturn(Optional.of(s));
        when(sectorRepo.existsById(1L)).thenReturn(true);
        when(clientRepo.existsById(7L)).thenReturn(true);
        when(portfolio.getPortfolio(DAY)).thenReturn(new PortfolioDto(DAY, List.of(new SectorBalanceDto(1L, "Pereira Mercasa",
                List.of(new ClientBalanceDto(7L, "Marina", bd("420000"), bd("1000000"), bd("0"), bd("200000"), bd("100000"),
                        bd("1120000"), List.of())), BigDecimal.ZERO)), null));
        when(packaging.balances(DAY)).thenReturn(Map.of(7L, 12));
    }

    @Test
    void buildsAccountSummaryActivityAndSortedTimeline() {
        when(lineRepo.lastPurchases(any(), any(), any())).thenReturn(List.of(
                new Object[]{DAY.minusDays(2), 9L, bd("702000")}, new Object[]{DAY.minusDays(40), 5L, bd("300000")}));
        when(paymentRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any(), any())).thenReturn(List.of(
                payment("ABONO", DAY.minusDays(2), "200000", "EFECTIVO", "Angela"),
                payment("DESCUENTO", DAY.minusDays(10), "5000", null, null)));
        PackagingReturnEntity e = new PackagingReturnEntity();
        e.setDay(DAY.minusDays(2));
        e.setBoxes(4);
        when(packagingRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any(), any())).thenReturn(List.of(e));

        ClientProfileDto p = service.getProfile(7L, DAY, 40);

        assertEquals(0, bd("1120000").compareTo(p.balance()));
        assertEquals(12, p.packaging());
        assertEquals("Pereira Mercasa", p.sector());
        assertEquals(2, p.daysSincePurchase());
        assertEquals(9, p.lastPurchase().boxes());
        assertEquals(0, bd("702000").compareTo(p.billed30()));       // la compra de hace 40 dias no entra
        assertEquals(0, bd("200000").compareTo(p.paid30()));          // el descuento no es dinero que entra
        assertEquals("Abono", p.lastPayment().label());
        assertFalse(p.overdue());
        // Mismo dia: compra, pago, vacias; luego el descuento y la compra antigua
        assertEquals(List.of("COMPRA", "PAGO", "VACIAS", "AJUSTE", "COMPRA"),
                p.timeline().stream().map(ClientProfileDto.MovementDto::kind).toList());
        assertEquals("efectivo · recibió Angela", p.timeline().get(1).detail());
    }

    @Test
    void clientWithBalanceAndOldLastPaymentIsOverdue() {
        when(lineRepo.lastPurchases(any(), any(), any())).thenReturn(List.of());
        when(paymentRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any(), any()))
                .thenReturn(List.of(payment("ABONO", DAY.minusDays(16), "50000", "NEQUI", null)));
        when(packagingRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any(), any())).thenReturn(List.of());
        assertTrue(service.getProfile(7L, DAY, 40).overdue());
    }

    @Test
    void recentPaymentIsNotOverdue() {
        when(lineRepo.lastPurchases(any(), any(), any())).thenReturn(List.of());
        when(paymentRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any(), any()))
                .thenReturn(List.of(payment("ABONO", DAY.minusDays(15), "50000", "NEQUI", null)));
        when(packagingRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any(), any())).thenReturn(List.of());
        assertFalse(service.getProfile(7L, DAY, 40).overdue());
    }

    @Test
    void timelineIsLimitedAndFlagsMore() {
        when(lineRepo.lastPurchases(any(), any(), any())).thenReturn(List.of(
                new Object[]{DAY, 1L, bd("1")}, new Object[]{DAY.minusDays(1), 1L, bd("1")}, new Object[]{DAY.minusDays(2), 1L, bd("1")}));
        when(paymentRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any(), any())).thenReturn(List.of());
        when(packagingRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(any(), any(), any())).thenReturn(List.of());
        ClientProfileDto p = service.getProfile(7L, DAY, 2);
        assertEquals(2, p.timeline().size());
        assertTrue(p.hasMore());
    }

    @Test
    void unknownClientIsRejected() {
        when(clientRepo.findById(99L)).thenReturn(Optional.empty());
        assertThrows(BusinessException.class, () -> service.getProfile(99L, DAY, 10));
    }

    @Test
    void updateValidatesNameAndSector() {
        assertThrows(BusinessException.class, () -> service.updateClient(7L, " ", 1L, null, null));
        assertThrows(BusinessException.class, () -> service.updateClient(7L, "Marina", 99L, null, null));
        service.updateClient(7L, " Marina P ", 1L, " 300 ", "");
        verify(clientRepo).save(argThat(c -> "Marina P".equals(c.getName()) && "300".equals(c.getPhone()) && c.getPlaza() == null));
    }

    @Test
    void notesAreValidatedAndOnlyDeletableByTheirOwner() {
        assertThrows(BusinessException.class, () -> service.addNote(7L, "  "));
        assertThrows(BusinessException.class, () -> service.addNote(7L, "x".repeat(1001)));
        service.addNote(7L, " Prefiere pagar en efectivo ");
        verify(noteRepo).save(argThat(n -> "Prefiere pagar en efectivo".equals(n.getContent())));

        ClientNoteEntity other = new ClientNoteEntity();
        other.setId(3L);
        other.setClientId(8L);
        when(noteRepo.findById(3L)).thenReturn(Optional.of(other));
        assertThrows(BusinessException.class, () -> service.deleteNote(7L, 3L));
    }
}
