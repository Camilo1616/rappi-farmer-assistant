package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ClientSearchResultDto;
import com.rappi.farmer.application.dtos.ClientSearchResultDto.*;
import com.rappi.farmer.application.dtos.PortfolioDto;
import com.rappi.farmer.application.dtos.PortfolioDto.ClientBalanceDto;
import com.rappi.farmer.domain.enums.PaymentType;
import com.rappi.farmer.infrastructure.persistence.entity.ClientPaymentEntity;
import com.rappi.farmer.infrastructure.persistence.repository.ClientPaymentJpaRepository;
import com.rappi.farmer.infrastructure.persistence.repository.DispatchLineJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Buscador de clientes. Con texto filtra por nombre o sector (sin tildes ni mayusculas);
 * sin texto devuelve los que mas deben, que es lo que normalmente se quiere ver primero.
 */
@Service
@RequiredArgsConstructor
public class ClientSearchService {

    static final int MAX_RESULTS = 15;

    private final PortfolioService portfolioService;
    private final DispatchLineJpaRepository lineRepo;
    private final ClientPaymentJpaRepository paymentRepo;

    @Transactional(readOnly = true)
    public List<ClientSearchResultDto> search(String query, LocalDate date) {
        String q = normalize(query);
        record Row(String sector, ClientBalanceDto client) {}
        List<Row> rows = new ArrayList<>();
        PortfolioDto portfolio = portfolioService.getPortfolio(date);
        portfolio.sectors().forEach(s -> s.clients().forEach(c -> {
            if (q.isEmpty() || normalize(c.name()).contains(q) || normalize(s.name()).contains(q)) {
                rows.add(new Row(s.name(), c));
            }
        }));
        if (q.isEmpty()) {
            rows.sort((a, b) -> b.client().balance().compareTo(a.client().balance()));
        } else {
            rows.sort(Comparator.comparing(r -> normalize(r.client().name())));
        }

        List<ClientSearchResultDto> out = new ArrayList<>();
        for (Row r : rows.subList(0, Math.min(rows.size(), MAX_RESULTS))) {
            ClientBalanceDto c = r.client();
            LastPurchaseDto last = null;
            Integer days = null;
            List<Object[]> purchases = lineRepo.lastPurchases(c.id(), date, PageRequest.of(0, 1));
            if (!purchases.isEmpty()) {
                Object[] p = purchases.get(0);
                LocalDate d = (LocalDate) p[0];
                last = new LastPurchaseDto(d, ((Number) p[1]).intValue(), new BigDecimal(p[2].toString()));
                days = (int) ChronoUnit.DAYS.between(d, date);
            }
            List<LastPaymentDto> pays = new ArrayList<>();
            for (ClientPaymentEntity p : paymentRepo.findTop3ByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(c.id(), date)) {
                pays.add(new LastPaymentDto(p.getDay(), PaymentType.valueOf(p.getType()).label(), p.getAmount(), p.getNote()));
            }
            out.add(new ClientSearchResultDto(c.id(), c.name(), r.sector(), c.balance(), c.openingBalance(),
                    last, days, pays));
        }
        return out;
    }

    static String normalize(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase().trim();
    }
}
