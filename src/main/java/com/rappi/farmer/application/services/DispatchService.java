package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.DispatchDayDto;
import com.rappi.farmer.application.dtos.DispatchDayDto.*;
import com.rappi.farmer.domain.enums.FruitCategory;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.exceptions.InsufficientStockException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Despacho diario de fresa por cajas y categorias.
 *
 * <p>Stock de una categoria al final de un dia = cosechas - entregas - descartes
 * acumulados hasta ese dia. Lo que sobra "arrastra" al dia siguiente (y debe salir primero).
 * Nunca puede quedar negativo: Angela entrega segun lo que hay.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DispatchService {

    /** Fecha tope para validar que el stock total (incluyendo dias futuros) no quede negativo. */
    private static final LocalDate FAR_FUTURE = LocalDate.of(9999, 12, 31);

    private final DispatchSectorJpaRepository sectorRepo;
    private final DispatchClientJpaRepository clientRepo;
    private final CategoryPriceJpaRepository priceRepo;
    private final HarvestJpaRepository harvestRepo;
    private final DiscardJpaRepository discardRepo;
    private final DispatchLineJpaRepository lineRepo;
    private final HarvestSource harvestSource;
    private final CropIntakeJpaRepository intakeRepo;

    // ── Consulta del dia ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DispatchDayDto getDay(LocalDate date) {
        Map<String, BigDecimal> prices = prices();
        Map<String, Integer> hUpTo = toMap(harvestSource.sumUpTo(date));
        Map<String, Integer> dUpTo = toMap(lineRepo.sumDeliveredUpTo(date));
        Map<String, Integer> xUpTo = toMap(discardRepo.sumUpTo(date));
        Map<String, Integer> hPrev = toMap(harvestSource.sumUpTo(date.minusDays(1)));
        Map<String, Integer> dPrev = toMap(lineRepo.sumDeliveredUpTo(date.minusDays(1)));
        Map<String, Integer> xPrev = toMap(discardRepo.sumUpTo(date.minusDays(1)));
        Map<String, Integer> cUpTo = toMap(intakeRepo.sumUpTo(date));
        Map<String, Integer> cPrev = toMap(intakeRepo.sumUpTo(date.minusDays(1)));

        List<StockDto> stock = new ArrayList<>();
        int carry = 0, harv = 0, deliv = 0, disc = 0, left = 0;
        for (FruitCategory c : FruitCategory.values()) {
            String k = c.name();
            int carryover = get(hPrev, k) - get(dPrev, k) - get(xPrev, k);
            int harvested = get(hUpTo, k) - get(hPrev, k);
            int delivered = get(dUpTo, k) - get(dPrev, k);
            int discarded = get(xUpTo, k) - get(xPrev, k);
            int available = carryover + harvested - delivered - discarded;
            stock.add(new StockDto(k, c.label(), carryover, harvested, delivered, discarded, available,
                    prices.getOrDefault(k, BigDecimal.ZERO), get(cUpTo, k) - get(cPrev, k)));
            carry += carryover; harv += harvested; deliv += delivered; disc += discarded; left += available;
        }

        Map<Long, List<DispatchLineEntity>> linesByClient = new HashMap<>();
        for (DispatchLineEntity l : lineRepo.findByDay(date)) {
            linesByClient.computeIfAbsent(l.getClientId(), x -> new ArrayList<>()).add(l);
        }
        Map<Long, List<DispatchClientEntity>> clientsBySector = new HashMap<>();
        for (DispatchClientEntity c : clientRepo.findAllByOrderByNameAsc()) {
            clientsBySector.computeIfAbsent(c.getSectorId(), x -> new ArrayList<>()).add(c);
        }

        BigDecimal salesTotal = BigDecimal.ZERO;
        List<SectorDto> sectors = new ArrayList<>();
        for (DispatchSectorEntity s : sectorRepo.findAllByOrderByNameAsc()) {
            List<ClientDto> clients = new ArrayList<>();
            int sOrdered = 0, sDelivered = 0;
            BigDecimal sTotal = BigDecimal.ZERO;
            for (DispatchClientEntity c : clientsBySector.getOrDefault(s.getId(), List.of())) {
                List<DispatchLineEntity> ls = linesByClient.getOrDefault(c.getId(), List.of());
                int ordered = 0, delivered = 0;
                BigDecimal total = BigDecimal.ZERO;
                List<LineDto> lineDtos = new ArrayList<>();
                for (DispatchLineEntity l : ls) {
                    ordered += l.getOrderedBoxes();
                    delivered += l.getDeliveredBoxes();
                    total = total.add(l.getUnitPrice().multiply(BigDecimal.valueOf(l.getDeliveredBoxes())));
                    lineDtos.add(new LineDto(l.getCategory(), l.getOrderedBoxes(), l.getDeliveredBoxes(), l.getUnitPrice()));
                }
                clients.add(new ClientDto(c.getId(), c.getName(), c.getOpeningBalance(), lineDtos, ordered, delivered, total));
                sOrdered += ordered; sDelivered += delivered; sTotal = sTotal.add(total);
            }
            sectors.add(new SectorDto(s.getId(), s.getName(), clients, sOrdered, sDelivered, sTotal));
            salesTotal = salesTotal.add(sTotal);
        }
        return new DispatchDayDto(date, stock, sectors, new SummaryDto(carry, harv, deliv, disc, left, salesTotal));
    }

    // ── Cosecha, descarte y despacho ─────────────────────────────────────────

    /** Fija las cajas cosechadas de una categoria en un dia (0 = borra el registro). */
    @Transactional
    public void setHarvest(LocalDate date, FruitCategory category, int boxes) {
        requireNonNegative(boxes);
        HarvestEntity h = harvestRepo.findByDayAndCategory(date, category.name()).orElseGet(() -> {
            HarvestEntity n = new HarvestEntity();
            n.setDay(date);
            n.setCategory(category.name());
            return n;
        });
        h.setBoxes(boxes);
        harvestRepo.save(h);
        requireStockNotNegative(date, category, "Ya se despacho o descarto mas de lo que quedaria cosechado");
    }

    /** Fija las cajas descartadas (merma) de una categoria en un dia. */
    @Transactional
    public void setDiscard(LocalDate date, FruitCategory category, int boxes) {
        requireNonNegative(boxes);
        DiscardEntity d = discardRepo.findByDayAndCategory(date, category.name()).orElseGet(() -> {
            DiscardEntity n = new DiscardEntity();
            n.setDay(date);
            n.setCategory(category.name());
            return n;
        });
        d.setBoxes(boxes);
        discardRepo.save(d);
        requireStockNotNegative(date, category, "No hay tantas cajas de " + category.label() + " para descartar");
    }

    /**
     * Fija pedido y entrega de un cliente en una categoria. La entrega puede ser distinta
     * del pedido (mas o menos), pero no puede superar el stock disponible.
     */
    @Transactional
    public void setLine(LocalDate date, Long clientId, FruitCategory category, int ordered, int delivered) {
        requireNonNegative(ordered);
        requireNonNegative(delivered);
        clientRepo.findById(clientId).orElseThrow(() -> new BusinessException("Cliente no encontrado"));

        Optional<DispatchLineEntity> existing = lineRepo.findByDayAndClientIdAndCategory(date, clientId, category.name());
        if (ordered == 0 && delivered == 0) {
            existing.ifPresent(lineRepo::delete);
            return;
        }
        DispatchLineEntity line = existing.orElseGet(() -> {
            DispatchLineEntity n = new DispatchLineEntity();
            n.setDay(date);
            n.setClientId(clientId);
            n.setCategory(category.name());
            // El precio se congela al crear la linea: cambios futuros no alteran facturas pasadas
            n.setUnitPrice(prices().getOrDefault(category.name(), BigDecimal.ZERO));
            return n;
        });
        line.setOrderedBoxes(ordered);
        line.setDeliveredBoxes(delivered);
        lineRepo.save(line);
        requireStockNotNegative(date, category, null, delivered);
    }

    // ── Catalogo: precios, sectores y clientes ───────────────────────────────

    @Transactional
    public void setPrice(FruitCategory category, BigDecimal price) {
        if (price == null || price.signum() < 0) throw new BusinessException("El precio no puede ser negativo");
        CategoryPriceEntity p = priceRepo.findById(category.name()).orElseGet(() -> {
            CategoryPriceEntity n = new CategoryPriceEntity();
            n.setCategory(category.name());
            return n;
        });
        p.setPrice(price);
        priceRepo.save(p);
    }

    @Transactional
    public DispatchSectorEntity createSector(String name) {
        DispatchSectorEntity s = new DispatchSectorEntity();
        s.setName(name.trim());
        return sectorRepo.save(s);
    }

    /** Crea un cliente con su saldo anterior (saldo de arranque cuadrado con cartera). */
    @Transactional
    public DispatchClientEntity createClient(Long sectorId, String name, BigDecimal openingBalance) {
        return createClient(sectorId, name, openingBalance, 0);
    }

    /** Igual, con las cajas vacias (empaque) que el cliente debe al arrancar. */
    @Transactional
    public DispatchClientEntity createClient(Long sectorId, String name, BigDecimal openingBalance, Integer openingPackaging) {
        sectorRepo.findById(sectorId).orElseThrow(() -> new BusinessException("Sector no encontrado"));
        DispatchClientEntity c = new DispatchClientEntity();
        c.setSectorId(sectorId);
        c.setName(name.trim());
        c.setOpeningBalance(openingBalance == null ? BigDecimal.ZERO : openingBalance);
        c.setOpeningPackaging(openingPackaging == null || openingPackaging < 0 ? 0 : openingPackaging);
        return clientRepo.save(c);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Map<String, BigDecimal> prices() {
        Map<String, BigDecimal> m = new HashMap<>();
        priceRepo.findAll().forEach(p -> m.put(p.getCategory(), p.getPrice()));
        return m;
    }

    private int stockUpTo(LocalDate date, FruitCategory category) {
        String k = category.name();
        return get(toMap(harvestSource.sumUpTo(date)), k)
                - get(toMap(lineRepo.sumDeliveredUpTo(date)), k)
                - get(toMap(discardRepo.sumUpTo(date)), k);
    }

    /** Lo usa el modulo de cultivos: si una entrada baja, el stock no puede quedar negativo. */
    public void assertSupplyChangeKeepsStockValid(LocalDate date, FruitCategory category) {
        requireStockNotNegative(date, category, "Ya se despachó o descartó más fresa de la que quedaría");
    }

    private void requireStockNotNegative(LocalDate date, FruitCategory category, String msg) {
        requireStockNotNegative(date, category, msg, null);
    }

    /**
     * Valida que el stock de la categoria no quede negativo ni al cierre del dia ni en total
     * (por si se edita un dia pasado con entregas posteriores). Si falla, la transaccion
     * se revierte y no se guarda nada.
     */
    private void requireStockNotNegative(LocalDate date, FruitCategory category, String msg, Integer delivered) {
        int shortage = Math.max(-stockUpTo(date, category), -stockUpTo(FAR_FUTURE, category));
        if (shortage <= 0) return;
        if (delivered != null) {
            throw new InsufficientStockException(category.label(), Math.max(delivered - shortage, 0));
        }
        throw new BusinessException(msg);
    }

    private static Map<String, Integer> toMap(List<Object[]> rows) {
        Map<String, Integer> m = new HashMap<>();
        for (Object[] r : rows) m.put((String) r[0], ((Number) r[1]).intValue());
        return m;
    }

    private static int get(Map<String, Integer> m, String k) {
        return m.getOrDefault(k, 0);
    }

    private static void requireNonNegative(int n) {
        if (n < 0) throw new BusinessException("La cantidad de cajas no puede ser negativa");
    }
}
