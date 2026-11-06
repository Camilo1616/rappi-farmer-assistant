package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.PortfolioDto;
import com.rappi.farmer.application.dtos.PortfolioDto.*;
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
 * Cartera de clientes: facturado (de los despachos) menos abonos, consignaciones y descuentos.
 * Reemplaza las columnas ABONO / CONSIGNACION / DESCUENTO / SALDO ACTUAL de la hoja del Drive.
 */
@Service
@RequiredArgsConstructor
public class PortfolioService {

    private final DispatchSectorJpaRepository sectorRepo;
    private final DispatchClientJpaRepository clientRepo;
    private final DispatchLineJpaRepository lineRepo;
    private final ClientPaymentJpaRepository paymentRepo;

    @Transactional(readOnly = true)
    public PortfolioDto getPortfolio(LocalDate date) {
        Map<Long, BigDecimal> billed = billedMap(lineRepo.billedUpTo(date));
        Map<Long, BigDecimal> billedPrev = billedMap(lineRepo.billedUpTo(date.minusDays(1)));
        Map<Long, Map<String, BigDecimal>> paid = new HashMap<>();
        for (Object[] r : paymentRepo.sumUpTo(date)) {
            paid.computeIfAbsent((Long) r[0], k -> new HashMap<>()).put((String) r[1], (BigDecimal) r[2]);
        }
        Map<Long, List<PaymentDto>> todayByClient = new HashMap<>();
        BigDecimal collectedToday = BigDecimal.ZERO, discountsToday = BigDecimal.ZERO;
        for (ClientPaymentEntity p : paymentRepo.findByDayOrderByIdAsc(date)) {
            PaymentType t = PaymentType.valueOf(p.getType());
            todayByClient.computeIfAbsent(p.getClientId(), k -> new ArrayList<>())
                    .add(new PaymentDto(p.getId(), t.name(), t.label(), p.getAmount(), p.getNote()));
            if (t.isCashIn()) collectedToday = collectedToday.add(p.getAmount());
            else discountsToday = discountsToday.add(p.getAmount());
        }

        Map<Long, List<DispatchClientEntity>> bySector = new HashMap<>();
        for (DispatchClientEntity c : clientRepo.findAllByOrderByNameAsc()) {
            bySector.computeIfAbsent(c.getSectorId(), k -> new ArrayList<>()).add(c);
        }

        BigDecimal receivable = BigDecimal.ZERO;
        List<SectorBalanceDto> sectors = new ArrayList<>();
        for (DispatchSectorEntity s : sectorRepo.findAllByOrderByNameAsc()) {
            List<ClientBalanceDto> clients = new ArrayList<>();
            BigDecimal sectorBalance = BigDecimal.ZERO;
            for (DispatchClientEntity c : bySector.getOrDefault(s.getId(), List.of())) {
                Map<String, BigDecimal> pm = paid.getOrDefault(c.getId(), Map.of());
                BigDecimal b = billed.getOrDefault(c.getId(), BigDecimal.ZERO);
                BigDecimal disc = pm.getOrDefault(PaymentType.DESCUENTO.name(), BigDecimal.ZERO);
                BigDecimal abonos = pm.getOrDefault(PaymentType.ABONO.name(), BigDecimal.ZERO);
                BigDecimal deps = pm.getOrDefault(PaymentType.CONSIGNACION.name(), BigDecimal.ZERO);
                BigDecimal balance = balance(c.getOpeningBalance(), b, disc, abonos, deps);
                clients.add(new ClientBalanceDto(c.getId(), c.getName(), c.getOpeningBalance(), b, disc, abonos,
                        deps, balance, todayByClient.getOrDefault(c.getId(), List.of())));
                sectorBalance = sectorBalance.add(balance);
            }
            sectors.add(new SectorBalanceDto(s.getId(), s.getName(), clients, sectorBalance));
            receivable = receivable.add(sectorBalance);
        }
        BigDecimal salesToday = billed.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .subtract(billedPrev.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));
        return new PortfolioDto(date, sectors,
                new SummaryDto(salesToday, collectedToday, discountsToday, receivable));
    }

    /** Saldo = saldo anterior + facturado - descuentos - abonos - consignaciones. */
    static BigDecimal balance(BigDecimal opening, BigDecimal billed, BigDecimal discounts,
                              BigDecimal payments, BigDecimal deposits) {
        return opening.add(billed).subtract(discounts).subtract(payments).subtract(deposits);
    }

    @Transactional
    public void addPayment(LocalDate date, Long clientId, PaymentType type, BigDecimal amount, String note) {
        if (amount == null || amount.signum() <= 0) {
            throw new BusinessException("El valor debe ser mayor a cero");
        }
        clientRepo.findById(clientId).orElseThrow(() -> new BusinessException("Cliente no encontrado"));
        ClientPaymentEntity p = new ClientPaymentEntity();
        p.setClientId(clientId);
        p.setDay(date);
        p.setType(type.name());
        p.setAmount(amount);
        p.setNote(note == null || note.isBlank() ? null : note.trim());
        p.setCreatedAt(LocalDateTime.now());
        paymentRepo.save(p);
    }

    /** Permite corregir un registro equivocado. */
    @Transactional
    public void deletePayment(Long id) {
        if (!paymentRepo.existsById(id)) throw new BusinessException("Registro no encontrado");
        paymentRepo.deleteById(id);
    }

    private static Map<Long, BigDecimal> billedMap(List<Object[]> rows) {
        Map<Long, BigDecimal> m = new HashMap<>();
        for (Object[] r : rows) m.put((Long) r[0], new BigDecimal(r[1].toString()));
        return m;
    }
}
