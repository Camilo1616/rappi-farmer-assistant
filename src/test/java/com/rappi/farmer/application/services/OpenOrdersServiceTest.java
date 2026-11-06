package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.DispatchDayDto;
import com.rappi.farmer.application.dtos.DispatchDayDto.*;
import com.rappi.farmer.application.dtos.OpenOrdersDto;
import com.rappi.farmer.application.dtos.SuggestionDto;
import com.rappi.farmer.domain.enums.FruitCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OpenOrdersServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 5);
    private DispatchService dispatch;
    private OpenOrdersService service;

    private static BigDecimal bd(String s) {
        return new BigDecimal(s);
    }

    private static ClientDto client(long id, String name, String balance, boolean overdue, LineDto... lines) {
        return new ClientDto(id, name, BigDecimal.ZERO, List.of(lines), 0, 0, BigDecimal.ZERO, bd(balance), overdue, null);
    }

    private static LineDto line(String category, int ordered, int delivered) {
        return new LineDto(category, ordered, delivered, bd("78000"));
    }

    /** Stock: solo SEGUNDA con 'available' cajas libres; el resto en cero. */
    private static List<StockDto> stock(int segundaAvailable) {
        List<StockDto> out = new ArrayList<>();
        for (FruitCategory c : FruitCategory.values()) {
            boolean seg = c == FruitCategory.SEGUNDA;
            out.add(new StockDto(c.name(), c.label(), 0, seg ? 10 : 0, 0, 0, seg ? segundaAvailable : 0, bd("78000"), 0));
        }
        return out;
    }

    private static int give(SuggestionDto s, String name) {
        return s.rows().stream().filter(r -> r.name().equals(name)).findFirst().orElseThrow().give();
    }

    @BeforeEach
    void setUp() {
        dispatch = mock(DispatchService.class);
        service = new OpenOrdersService(dispatch);
    }

    private void day(int available, ClientDto... clients) {
        SectorDto sector = new SectorDto(1L, "Mercasa", List.of(clients), 0, 0, BigDecimal.ZERO);
        when(dispatch.getDay(DAY)).thenReturn(new DispatchDayDto(DAY, stock(available), List.of(sector), null));
    }

    @Test
    void consolidatesOrderedDeliveredPendingAndShortage() {
        // Pidieron 5+4=9 de Segunda, ya se entregaron 2 -> pendientes 7; quedan libres 4 -> faltan 3
        day(4, client(1, "Ana", "0", false, line("SEGUNDA", 5, 2)), client(2, "Beto", "0", false, line("SEGUNDA", 4, 0)));
        OpenOrdersDto r = service.getOpenOrders(DAY);
        OpenOrdersDto.CategoryRow seg = r.categories().stream().filter(c -> c.category().equals("SEGUNDA")).findFirst().orElseThrow();
        assertEquals(9, seg.ordered());
        assertEquals(2, seg.delivered());
        assertEquals(7, seg.pending());
        assertEquals(4, seg.free());
        assertEquals(3, seg.shortage());
        assertEquals(0, seg.surplus());
        assertEquals(7, r.summary().pending());
        assertEquals(3, r.summary().shortage());
        assertEquals(2, r.clients().size());
    }

    @Test
    void surplusWhenThereIsMoreFruitThanOrders() {
        day(10, client(1, "Ana", "0", false, line("SEGUNDA", 3, 0)));
        OpenOrdersDto.CategoryRow seg = service.getOpenOrders(DAY).categories().stream()
                .filter(c -> c.category().equals("SEGUNDA")).findFirst().orElseThrow();
        assertEquals(7, seg.surplus());
        assertEquals(0, seg.shortage());
    }

    @Test
    void listsOverdueClientsBiggestDebtFirstWithTheirPendingBoxes() {
        day(10, client(1, "Ana", "100000", true, line("SEGUNDA", 3, 0)), client(2, "Beto", "900000", true),
                client(3, "Cata", "0", false));
        List<OpenOrdersDto.OverdueRow> o = service.getOpenOrders(DAY).overdue();
        assertEquals(List.of("Beto", "Ana"), o.stream().map(OpenOrdersDto.OverdueRow::name).toList());
        assertEquals(3, o.get(1).pendingBoxes());
    }

    @Test
    void suggestionServesClientsUpToDateFirstAndMorososLast() {
        // 5 libres; pendientes: moroso 4, al dia 3 (saldo mayor), al dia 2 (saldo menor)
        day(5, client(1, "Moroso", "500000", true, line("SEGUNDA", 4, 0)),
                client(2, "AlDiaDebe", "200000", false, line("SEGUNDA", 3, 0)),
                client(3, "AlDiaLimpio", "0", false, line("SEGUNDA", 2, 0)));
        SuggestionDto s = service.suggest(DAY);
        assertEquals(2, give(s, "AlDiaLimpio"));   // menor saldo primero
        assertEquals(3, give(s, "AlDiaDebe"));
        assertEquals(0, give(s, "Moroso"));        // ya no queda fresa
        assertEquals(5, s.totalToGive());
        assertEquals(4, s.totalUncovered());
    }

    @Test
    void suggestionGivesPartialAmountsAndNeverMoreThanFree() {
        day(2, client(1, "Ana", "0", false, line("SEGUNDA", 5, 1)));
        SuggestionDto.Row r = service.suggest(DAY).rows().get(0);
        assertEquals(2, r.give());          // pendientes 4, solo hay 2
        assertEquals(2, r.uncovered());
    }

    @Test
    void applyAddsTheAssignedBoxesToDeliveredAndSkipsZeroRows() {
        day(3, client(1, "Ana", "0", false, line("SEGUNDA", 5, 1)), client(2, "Moroso", "100", true, line("SEGUNDA", 4, 0)));
        int applied = service.apply(DAY);
        assertEquals(3, applied);
        verify(dispatch).setLine(DAY, 1L, FruitCategory.SEGUNDA, 5, 4);      // 1 ya entregada + 3
        verify(dispatch, never()).setLine(eq(DAY), eq(2L), any(), anyInt(), anyInt());
    }
}
