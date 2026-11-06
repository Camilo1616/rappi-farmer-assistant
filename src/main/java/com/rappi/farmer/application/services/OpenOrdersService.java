package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.DispatchDayDto;
import com.rappi.farmer.application.dtos.DispatchDayDto.*;
import com.rappi.farmer.application.dtos.OpenOrdersDto;
import com.rappi.farmer.application.dtos.OpenOrdersDto.*;
import com.rappi.farmer.application.dtos.SuggestionDto;
import com.rappi.farmer.domain.enums.FruitCategory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Consolidacion de pedidos abiertos: cuanto se pidio contra cuanta fresa hay, por categoria,
 * y un reparto sugerido cuando no alcanza. Prioridad del reparto: primero los clientes al dia,
 * luego los de menor saldo (los morosos quedan de ultimos, como decide Angela hoy a mano).
 */
@Service
@RequiredArgsConstructor
public class OpenOrdersService {

    private final DispatchService dispatchService;

    @Transactional(readOnly = true)
    public OpenOrdersDto getOpenOrders(LocalDate date) {
        DispatchDayDto day = dispatchService.getDay(date);

        Map<String, int[]> perCat = new HashMap<>(); // [pedido, entregado, pendiente]
        List<ClientRow> clients = new ArrayList<>();
        List<OverdueRow> overdue = new ArrayList<>();
        for (SectorDto s : day.sectors()) {
            for (ClientDto c : s.clients()) {
                List<PendingLine> lines = new ArrayList<>();
                int pendingTotal = 0;
                for (LineDto l : c.lines()) {
                    int pending = Math.max(l.ordered() - l.delivered(), 0);
                    int[] v = perCat.computeIfAbsent(l.category(), k -> new int[3]);
                    v[0] += l.ordered();
                    v[1] += l.delivered();
                    v[2] += pending;
                    if (pending > 0) {
                        lines.add(new PendingLine(l.category(), FruitCategory.valueOf(l.category()).label(), pending));
                        pendingTotal += pending;
                    }
                }
                if (pendingTotal > 0) clients.add(new ClientRow(c.id(), c.name(), s.name(), c.overdue(), c.balance(), pendingTotal, lines));
                if (c.overdue()) overdue.add(new OverdueRow(c.id(), c.name(), s.name(), c.balance(), c.daysSincePayment(), pendingTotal));
            }
        }
        clients.sort(Comparator.comparing(ClientRow::sector).thenComparing(ClientRow::name));
        overdue.sort((a, b) -> b.balance().compareTo(a.balance()));

        List<CategoryRow> categories = new ArrayList<>();
        int ordered = 0, delivered = 0, pending = 0, shortage = 0;
        for (StockDto st : day.stock()) {
            int[] v = perCat.getOrDefault(st.category(), new int[3]);
            int supply = st.carryover() + st.harvested() - st.discarded();
            int free = st.available();
            int short_ = Math.max(v[2] - free, 0);
            categories.add(new CategoryRow(st.category(), st.label(), supply, v[0], v[1], v[2], free, short_, Math.max(free - v[2], 0)));
            ordered += v[0]; delivered += v[1]; pending += v[2]; shortage += short_;
        }
        return new OpenOrdersDto(date, categories, clients, overdue, new OpenOrdersDto.SummaryDto(ordered, delivered, pending, shortage));
    }

    /** Calcula (sin guardar) como repartir la fresa disponible entre los pedidos pendientes. */
    @Transactional(readOnly = true)
    public SuggestionDto suggest(LocalDate date) {
        DispatchDayDto day = dispatchService.getDay(date);
        record Pending(ClientDto client, String sector, LineDto line, int pending) {}

        List<SuggestionDto.Row> rows = new ArrayList<>();
        int totalGive = 0, totalUncovered = 0;
        for (StockDto st : day.stock()) {
            List<Pending> list = new ArrayList<>();
            for (SectorDto s : day.sectors()) {
                for (ClientDto c : s.clients()) {
                    for (LineDto l : c.lines()) {
                        int pend = Math.max(l.ordered() - l.delivered(), 0);
                        if (l.category().equals(st.category()) && pend > 0) list.add(new Pending(c, s.name(), l, pend));
                    }
                }
            }
            // Al dia primero; entre iguales, menor saldo primero; luego por nombre
            list.sort(Comparator.<Pending, Boolean>comparing(p -> p.client().overdue())
                    .thenComparing(p -> p.client().balance() == null ? BigDecimal.ZERO : p.client().balance())
                    .thenComparing(p -> p.client().name()));
            int free = Math.max(st.available(), 0);
            for (Pending p : list) {
                int give = Math.min(p.pending(), free);
                free -= give;
                int uncovered = p.pending() - give;
                rows.add(new SuggestionDto.Row(p.client().id(), p.client().name(), p.sector(), st.category(), st.label(),
                        p.line().ordered(), p.line().delivered(), give, uncovered, p.client().overdue()));
                totalGive += give;
                totalUncovered += uncovered;
            }
        }
        rows.sort(Comparator.comparing(SuggestionDto.Row::sector).thenComparing(SuggestionDto.Row::name)
                .thenComparing(SuggestionDto.Row::category));
        return new SuggestionDto(date, rows, totalGive, totalUncovered);
    }

    /**
     * Aplica el reparto sugerido: suma a lo entregado de cada linea las cajas asignadas.
     * Se recalcula aqui (no se confia en lo que muestre el cliente) y todo ocurre en una transaccion.
     */
    @Transactional
    public int apply(LocalDate date) {
        int applied = 0;
        for (SuggestionDto.Row r : suggest(date).rows()) {
            if (r.give() <= 0) continue;
            dispatchService.setLine(date, r.clientId(), FruitCategory.valueOf(r.category()), r.ordered(), r.delivered() + r.give());
            applied += r.give();
        }
        return applied;
    }
}
