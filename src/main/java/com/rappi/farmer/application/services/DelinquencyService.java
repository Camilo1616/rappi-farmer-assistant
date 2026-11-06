package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ClientDelinquency;
import com.rappi.farmer.infrastructure.persistence.repository.ClientPaymentJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.DispatchLineJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

/**
 * Regla unica de mora: un cliente esta en mora si tiene saldo y lleva mas de {@link #OVERDUE_DAYS}
 * dias sin pagar. Si nunca ha pagado, se mide desde su primera compra con entrega.
 */
@Service
@RequiredArgsConstructor
public class DelinquencyService {

    /** Dias sin pagar a partir de los cuales un cliente con saldo se considera "en mora". */
    public static final int OVERDUE_DAYS = 15;

    private final PortfolioService portfolioService;
    private final ClientPaymentJpaRepository paymentRepo;
    private final DispatchLineJpaRepository lineRepo;

    public static boolean isOverdue(BigDecimal balance, Integer referenceDays) {
        return balance != null && balance.signum() > 0 && referenceDays != null && referenceDays > OVERDUE_DAYS;
    }

    /** Estado de cartera de todos los clientes a la fecha dada. */
    @Transactional(readOnly = true)
    public Map<Long, ClientDelinquency> infoByClient(LocalDate date) {
        Map<Long, LocalDate> lastPay = new HashMap<>();
        for (Object[] r : paymentRepo.lastCashInByClient(date)) lastPay.put((Long) r[0], (LocalDate) r[1]);
        Map<Long, LocalDate> firstBuy = new HashMap<>();
        for (Object[] r : lineRepo.firstPurchaseByClient(date)) firstBuy.put((Long) r[0], (LocalDate) r[1]);

        Map<Long, ClientDelinquency> out = new HashMap<>();
        portfolioService.getPortfolio(date).sectors().forEach(s -> s.clients().forEach(c -> {
            LocalDate ref = lastPay.containsKey(c.id()) ? lastPay.get(c.id()) : firstBuy.get(c.id());
            Integer days = ref == null ? null : (int) ChronoUnit.DAYS.between(ref, date);
            Integer sincePayment = lastPay.containsKey(c.id()) ? days : null;
            out.put(c.id(), new ClientDelinquency(c.balance(), sincePayment, isOverdue(c.balance(), days)));
        }));
        return out;
    }
}
