package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.CollectionRunDto;
import com.rappi.farmer.application.dtos.CollectionRunDto.*;
import com.rappi.farmer.application.dtos.PortfolioDto;
import com.rappi.farmer.domain.enums.PaymentType;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Cobro presencial. Se arma una hoja con los clientes que visitara el conductor (con lo que
 * debe cada uno y sus vacias), se registra lo que cobra por metodo, se aclaran las diferencias
 * y al final se cuadra el efectivo que debe entregar (cobrado - gastos del viaje).
 * Los pagos quedan en la cartera del cliente, igual que cualquier otro abono.
 */
@Service
@RequiredArgsConstructor
public class CollectionService {

    public static final Set<String> METHODS = Set.of("EFECTIVO", "NEQUI", "CONSIGNACION");
    public static final Set<String> RESOLUTIONS = Set.of("DEBE", "DESCUENTO", "FALTANTE");

    private final CollectionRunJpaRepository runRepo;
    private final CollectionItemJpaRepository itemRepo;
    private final ClientPaymentJpaRepository paymentRepo;
    private final PackagingReturnJpaRepository packagingRepo;
    private final DispatchClientJpaRepository clientRepo;
    private final DispatchSectorJpaRepository sectorRepo;
    private final TripEntryJpaRepository tripEntryRepo;
    private final PortfolioService portfolioService;
    private final PackagingService packagingService;

    // ── Consulta ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CollectionRunDto> getDay(LocalDate date) {
        List<CollectionRunDto> out = new ArrayList<>();
        for (CollectionRunEntity r : runRepo.findByDayOrderByIdAsc(date)) out.add(toDto(r));
        return out;
    }

    private CollectionRunDto toDto(CollectionRunEntity run) {
        List<CollectionItemEntity> items = itemRepo.findByRunId(run.getId());
        Map<Long, List<ClientPaymentEntity>> pays = new HashMap<>();
        BigDecimal collected = BigDecimal.ZERO, cash = BigDecimal.ZERO, nequi = BigDecimal.ZERO,
                deposit = BigDecimal.ZERO, discounts = BigDecimal.ZERO;
        // Los totales salen de todos los pagos de la hoja, no solo de los clientes listados
        for (ClientPaymentEntity p : paymentRepo.findByRunId(run.getId())) {
            pays.computeIfAbsent(p.getClientId(), k -> new ArrayList<>()).add(p);
            if (PaymentType.valueOf(p.getType()).isCashIn()) {
                collected = collected.add(p.getAmount());
                if ("EFECTIVO".equals(p.getMethod())) cash = cash.add(p.getAmount());
                else if ("NEQUI".equals(p.getMethod())) nequi = nequi.add(p.getAmount());
                else deposit = deposit.add(p.getAmount());
            } else {
                discounts = discounts.add(p.getAmount());
            }
        }
        Map<Long, List<PackagingReturnEntity>> empties = new HashMap<>();
        for (PackagingReturnEntity e : packagingRepo.findByRunId(run.getId())) {
            empties.computeIfAbsent(e.getClientId(), k -> new ArrayList<>()).add(e);
        }
        Map<Long, DispatchClientEntity> clients = new HashMap<>();
        clientRepo.findAllById(items.stream().map(CollectionItemEntity::getClientId).toList())
                .forEach(c -> clients.put(c.getId(), c));
        Map<Long, String> sectors = new HashMap<>();
        sectorRepo.findAll().forEach(s -> sectors.put(s.getId(), s.getName()));

        BigDecimal owed = BigDecimal.ZERO, remaining = BigDecimal.ZERO;
        int emptiesTotal = 0, pending = 0, reviews = 0;
        List<ItemDto> dtos = new ArrayList<>();
        for (CollectionItemEntity it : items) {
            DispatchClientEntity c = clients.get(it.getClientId());
            BigDecimal itCollected = BigDecimal.ZERO, itDiscounts = BigDecimal.ZERO;
            List<PaymentLineDto> lines = new ArrayList<>();
            for (ClientPaymentEntity p : pays.getOrDefault(it.getClientId(), List.of())) {
                PaymentType t = PaymentType.valueOf(p.getType());
                lines.add(new PaymentLineDto(p.getId(), t.label(), p.getMethod(), p.getAmount(), p.getReceivedBy(), p.getNote()));
                if (t.isCashIn()) itCollected = itCollected.add(p.getAmount());
                else itDiscounts = itDiscounts.add(p.getAmount());
            }
            List<EmptiesDto> eds = new ArrayList<>();
            int itEmpties = 0;
            for (PackagingReturnEntity e : empties.getOrDefault(it.getClientId(), List.of())) {
                eds.add(new EmptiesDto(e.getId(), e.getBoxes()));
                itEmpties += e.getBoxes();
            }
            BigDecimal itRemaining = it.getOwedSnapshot().subtract(itCollected).subtract(itDiscounts);
            String status = itCollected.signum() == 0 && itDiscounts.signum() == 0 ? "SIN_COBRO"
                    : itRemaining.signum() <= 0 ? "COMPLETO" : "PARCIAL";
            boolean clarify = itCollected.signum() > 0 && itRemaining.signum() > 0 && it.getResolution() == null;
            dtos.add(new ItemDto(it.getId(), it.getClientId(), c != null ? c.getName() : "?",
                    c != null ? sectors.getOrDefault(c.getSectorId(), "") : "", it.getOwedSnapshot(),
                    it.getPackagingSnapshot(), Boolean.TRUE.equals(it.getAddedManually()),
                    Boolean.TRUE.equals(it.getNeedsReview()), it.getResolution(), itCollected, itDiscounts,
                    itRemaining, status, clarify, lines, eds, itEmpties));
            owed = owed.add(it.getOwedSnapshot());
            remaining = remaining.add(itRemaining.max(BigDecimal.ZERO));
            emptiesTotal += itEmpties;
            if (clarify) pending++;
            if (Boolean.TRUE.equals(it.getNeedsReview())) reviews++;
        }
        dtos.sort(Comparator.comparing(ItemDto::sector).thenComparing(ItemDto::name));

        BigDecimal tripExpenses = BigDecimal.ZERO;
        if (run.getTripId() != null) {
            for (TripEntryEntity e : tripEntryRepo.findByTripIdIn(List.of(run.getTripId()))) {
                if (TripService.EXPENSE.equals(e.getType())) tripExpenses = tripExpenses.add(e.getAmount());
            }
        }
        BigDecimal expected = cash.subtract(tripExpenses);
        BigDecimal diff = run.getHandedAmount() == null ? null : run.getHandedAmount().subtract(expected);
        return new CollectionRunDto(run.getId(), run.getDay(), run.getDriverName(), run.getDestination(), run.getTripId(),
                Boolean.TRUE.equals(run.getClosed()), dtos,
                new TotalsDto(owed, collected, cash, nequi, deposit, discounts, remaining, emptiesTotal, pending, reviews),
                new HandoverDto(cash, tripExpenses, expected, run.getHandedAmount(), run.getHandedTo(), diff));
    }

    // ── Armar la hoja ────────────────────────────────────────────────────────

    /** Crea la hoja con los clientes de los sectores elegidos que deben plata o vacias, mas los elegidos a mano. */
    @Transactional
    public LocalDate createRun(LocalDate date, String driver, String destination, Long tripId,
                               List<Long> sectorIds, List<Long> clientIds) {
        PortfolioDto portfolio = portfolioService.getPortfolio(date);
        Map<Long, Integer> packaging = packagingService.balances(date);
        Set<Long> sectorSet = new HashSet<>(sectorIds == null ? List.of() : sectorIds);
        Set<Long> pick = new LinkedHashSet<>(clientIds == null ? List.of() : clientIds);

        Map<Long, BigDecimal> balances = new HashMap<>();
        List<Long> auto = new ArrayList<>();
        portfolio.sectors().forEach(s -> s.clients().forEach(c -> {
            balances.put(c.id(), c.balance());
            boolean owes = c.balance().signum() > 0 || packaging.getOrDefault(c.id(), 0) > 0;
            if (sectorSet.contains(s.id()) && owes) auto.add(c.id());
        }));
        pick.addAll(auto);
        if (pick.isEmpty()) throw new BusinessException("Selecciona al menos un sector con clientes que deban o un cliente");
        for (Long id : pick) if (!balances.containsKey(id)) throw new BusinessException("Cliente no encontrado");

        CollectionRunEntity run = new CollectionRunEntity();
        run.setDay(date);
        run.setDriverName(blankToNull(driver));
        run.setDestination(blankToNull(destination));
        run.setTripId(tripId);
        run = runRepo.save(run);
        for (Long id : pick) saveItem(run.getId(), id, balances.get(id), packaging.getOrDefault(id, 0), !auto.contains(id));
        return date;
    }

    /** Cliente que no estaba en la hoja pero si pago: se busca y se agrega. */
    @Transactional
    public LocalDate addClient(Long runId, Long clientId) {
        CollectionRunEntity run = getRun(runId);
        if (itemRepo.existsByRunIdAndClientId(runId, clientId)) throw new BusinessException("El cliente ya está en la hoja");
        BigDecimal balance = portfolioService.getPortfolio(run.getDay()).sectors().stream()
                .flatMap(s -> s.clients().stream()).filter(c -> c.id().equals(clientId)).findFirst()
                .orElseThrow(() -> new BusinessException("Cliente no encontrado")).balance();
        saveItem(runId, clientId, balance, packagingService.balances(run.getDay()).getOrDefault(clientId, 0), true);
        return run.getDay();
    }

    @Transactional
    public LocalDate removeItem(Long itemId) {
        CollectionItemEntity it = getItem(itemId);
        CollectionRunEntity run = getRun(it.getRunId());
        boolean hasMoney = paymentRepo.findByRunId(run.getId()).stream().anyMatch(p -> p.getClientId().equals(it.getClientId()));
        boolean hasEmpties = packagingRepo.findByRunId(run.getId()).stream().anyMatch(e -> e.getClientId().equals(it.getClientId()));
        if (hasMoney || hasEmpties) throw new BusinessException("Quita primero los pagos y vacías de este cliente");
        itemRepo.delete(it);
        return run.getDay();
    }

    @Transactional
    public LocalDate deleteRun(Long runId) {
        CollectionRunEntity run = getRun(runId);
        if (!paymentRepo.findByRunId(runId).isEmpty() || !packagingRepo.findByRunId(runId).isEmpty()) {
            throw new BusinessException("La hoja tiene pagos o vacías registrados; quítalos primero");
        }
        itemRepo.deleteByRunId(runId);
        runRepo.delete(run);
        return run.getDay();
    }

    // ── Registrar lo cobrado ─────────────────────────────────────────────────

    /** Registra un pago (efectivo, Nequi o consignacion) y/o vacias recibidas para un cliente de la hoja. */
    @Transactional
    public LocalDate collect(Long itemId, BigDecimal amount, String method, String receivedBy, String note, Integer empties) {
        CollectionItemEntity it = getItem(itemId);
        CollectionRunEntity run = getRun(it.getRunId());
        boolean hasAmount = amount != null && amount.signum() != 0;
        boolean hasEmpties = empties != null && empties != 0;
        if (!hasAmount && !hasEmpties) throw new BusinessException("Indica un valor cobrado o vacías recibidas");
        if (hasAmount) {
            if (amount.signum() < 0) throw new BusinessException("El valor debe ser mayor a cero");
            if (method == null || !METHODS.contains(method)) throw new BusinessException("Método de pago inválido");
            ClientPaymentEntity p = new ClientPaymentEntity();
            p.setClientId(it.getClientId());
            p.setDay(run.getDay());
            p.setType("CONSIGNACION".equals(method) ? PaymentType.CONSIGNACION.name() : PaymentType.ABONO.name());
            p.setAmount(amount);
            p.setMethod(method);
            p.setReceivedBy(blankToNull(receivedBy));
            p.setNote(blankToNull(note));
            p.setRunId(run.getId());
            p.setCreatedAt(LocalDateTime.now());
            paymentRepo.save(p);
        }
        if (hasEmpties) {
            if (empties < 0) throw new BusinessException("Las vacías deben ser mayor a cero");
            PackagingReturnEntity e = new PackagingReturnEntity();
            e.setClientId(it.getClientId());
            e.setDay(run.getDay());
            e.setBoxes(empties);
            e.setRunId(run.getId());
            packagingRepo.save(e);
        }
        return run.getDay();
    }

    /**
     * Aclara la diferencia entre lo que debia y lo que pago:
     * DEBE (sigue en su saldo), DESCUENTO o FALTANTE de fresa (bajan el saldo por el valor indicado).
     */
    @Transactional
    public LocalDate resolve(Long itemId, String resolution, BigDecimal amount, String note) {
        if (resolution == null || !RESOLUTIONS.contains(resolution)) throw new BusinessException("Resolución inválida");
        CollectionItemEntity it = getItem(itemId);
        CollectionRunEntity run = getRun(it.getRunId());
        if (!"DEBE".equals(resolution)) {
            BigDecimal remaining = remainingOf(it, run);
            if (amount == null || amount.signum() <= 0) throw new BusinessException("El valor debe ser mayor a cero");
            if (amount.compareTo(remaining) > 0) throw new BusinessException("No puede superar lo que falta por cobrar");
            ClientPaymentEntity p = new ClientPaymentEntity();
            p.setClientId(it.getClientId());
            p.setDay(run.getDay());
            p.setType("FALTANTE".equals(resolution) ? PaymentType.FALTANTE.name() : PaymentType.DESCUENTO.name());
            p.setAmount(amount);
            p.setNote(blankToNull(note));
            p.setRunId(run.getId());
            p.setCreatedAt(LocalDateTime.now());
            paymentRepo.save(p);
        }
        it.setResolution(resolution);
        itemRepo.save(it);
        return run.getDay();
    }

    @Transactional
    public LocalDate setReview(Long itemId, boolean needsReview) {
        CollectionItemEntity it = getItem(itemId);
        it.setNeedsReview(needsReview);
        itemRepo.save(it);
        return getRun(it.getRunId()).getDay();
    }

    /** Quita un pago de la hoja (para corregir errores). Solo pagos que pertenezcan a una hoja. */
    @Transactional
    public LocalDate deletePayment(Long paymentId) {
        ClientPaymentEntity p = paymentRepo.findById(paymentId).orElseThrow(() -> new BusinessException("Pago no encontrado"));
        if (p.getRunId() == null) throw new BusinessException("Este pago no pertenece a una hoja de cobro");
        paymentRepo.delete(p);
        return p.getDay();
    }

    @Transactional
    public LocalDate deleteEmpties(Long id) {
        PackagingReturnEntity e = packagingRepo.findById(id).orElseThrow(() -> new BusinessException("Registro no encontrado"));
        packagingRepo.delete(e);
        return e.getDay();
    }

    // ── Cuadre del efectivo ──────────────────────────────────────────────────

    /** Registra cuanto entrego el conductor y a quien. La diferencia contra lo esperado queda a la vista. */
    @Transactional
    public LocalDate handover(Long runId, BigDecimal handedAmount, String handedTo) {
        CollectionRunEntity run = getRun(runId);
        if (handedAmount == null || handedAmount.signum() < 0) throw new BusinessException("El valor entregado no es válido");
        if (handedTo == null || handedTo.isBlank()) throw new BusinessException("Indica a quién se entregó el efectivo");
        run.setHandedAmount(handedAmount);
        run.setHandedTo(handedTo.trim());
        run.setClosed(true);
        runRepo.save(run);
        return run.getDay();
    }

    @Transactional
    public LocalDate reopen(Long runId) {
        CollectionRunEntity run = getRun(runId);
        run.setClosed(false);
        runRepo.save(run);
        return run.getDay();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private BigDecimal remainingOf(CollectionItemEntity it, CollectionRunEntity run) {
        BigDecimal done = BigDecimal.ZERO;
        for (ClientPaymentEntity p : paymentRepo.findByRunId(run.getId())) {
            if (p.getClientId().equals(it.getClientId())) done = done.add(p.getAmount());
        }
        return it.getOwedSnapshot().subtract(done);
    }

    private void saveItem(Long runId, Long clientId, BigDecimal owed, int packaging, boolean manual) {
        CollectionItemEntity it = new CollectionItemEntity();
        it.setRunId(runId);
        it.setClientId(clientId);
        it.setOwedSnapshot(owed);
        it.setPackagingSnapshot(packaging);
        it.setAddedManually(manual);
        itemRepo.save(it);
    }

    private CollectionRunEntity getRun(Long id) {
        return runRepo.findById(id).orElseThrow(() -> new BusinessException("Hoja de cobro no encontrada"));
    }

    private CollectionItemEntity getItem(Long id) {
        return itemRepo.findById(id).orElseThrow(() -> new BusinessException("Cliente de la hoja no encontrado"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
