package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.ClientProfileDto;
import com.rappi.farmer.application.dtos.ClientProfileDto.*;
import com.rappi.farmer.application.dtos.PortfolioDto.ClientBalanceDto;
import com.rappi.farmer.domain.enums.PaymentType;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Ficha del cliente: estado de cuenta, actividad reciente, historial unificado
 * (compras, pagos, descuentos y vacias), datos de contacto y notas.
 */
@Service
@RequiredArgsConstructor
public class ClientProfileService {

    private static final int FETCH_ROWS = 200;

    private final DispatchClientJpaRepository clientRepo;
    private final DispatchSectorJpaRepository sectorRepo;
    private final DispatchLineJpaRepository lineRepo;
    private final ClientPaymentJpaRepository paymentRepo;
    private final PackagingReturnJpaRepository packagingRepo;
    private final ClientNoteJpaRepository noteRepo;
    private final PortfolioService portfolioService;
    private final PackagingService packagingService;

    @Transactional(readOnly = true)
    public ClientProfileDto getProfile(Long clientId, LocalDate date, int limit) {
        DispatchClientEntity client = clientRepo.findById(clientId)
                .orElseThrow(() -> new BusinessException("Cliente no encontrado"));
        String sector = sectorRepo.findById(client.getSectorId()).map(DispatchSectorEntity::getName).orElse("");
        ClientBalanceDto bal = portfolioService.getPortfolio(date).sectors().stream()
                .flatMap(s -> s.clients().stream()).filter(c -> c.id().equals(clientId)).findFirst()
                .orElseThrow(() -> new BusinessException("Cliente no encontrado"));

        List<MovementDto> all = new ArrayList<>();
        LocalDate since30 = date.minusDays(30);
        BigDecimal billed30 = BigDecimal.ZERO, paid30 = BigDecimal.ZERO;
        LastPurchaseDto lastPurchase = null;
        LocalDate firstPurchase = null;

        for (Object[] r : lineRepo.lastPurchases(clientId, date, PageRequest.of(0, FETCH_ROWS))) {
            LocalDate d = (LocalDate) r[0];
            int boxes = ((Number) r[1]).intValue();
            BigDecimal total = new BigDecimal(r[2].toString());
            if (lastPurchase == null) lastPurchase = new LastPurchaseDto(d, boxes, total);
            firstPurchase = d;
            if (d.isAfter(since30)) billed30 = billed30.add(total);
            all.add(new MovementDto(d, "COMPRA", "Compra", boxes + (boxes == 1 ? " caja" : " cajas"), total, boxes));
        }

        LastPaymentDto lastPayment = null;
        for (ClientPaymentEntity p : paymentRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(
                clientId, date, PageRequest.of(0, FETCH_ROWS))) {
            PaymentType t = PaymentType.valueOf(p.getType());
            if (t.isCashIn()) {
                if (lastPayment == null) lastPayment = new LastPaymentDto(p.getDay(), t.label(), p.getAmount());
                if (p.getDay().isAfter(since30)) paid30 = paid30.add(p.getAmount());
            }
            all.add(new MovementDto(p.getDay(), t.isCashIn() ? "PAGO" : "AJUSTE", t.label(), paymentDetail(p), p.getAmount(), null));
        }
        for (PackagingReturnEntity e : packagingRepo.findByClientIdAndDayLessThanEqualOrderByDayDescIdDesc(
                clientId, date, PageRequest.of(0, FETCH_ROWS))) {
            all.add(new MovementDto(e.getDay(), "VACIAS", "Vacías devueltas", e.getBoxes() + " cajas vacías", null, e.getBoxes()));
        }

        // Mas reciente primero; el mismo dia: compra, pago/ajuste, vacias
        all.sort(Comparator.comparing(MovementDto::date).reversed().thenComparing(m -> rank(m.kind())));
        boolean hasMore = all.size() > limit;
        List<MovementDto> timeline = all.subList(0, Math.min(all.size(), limit));

        Integer daysSincePurchase = lastPurchase == null ? null : (int) ChronoUnit.DAYS.between(lastPurchase.date(), date);
        Integer daysSincePayment = lastPayment == null ? null : (int) ChronoUnit.DAYS.between(lastPayment.date(), date);
        // Sin pagos registrados se mide desde su compra mas antigua conocida
        Integer reference = daysSincePayment != null ? daysSincePayment
                : firstPurchase == null ? null : (int) ChronoUnit.DAYS.between(firstPurchase, date);
        boolean overdue = DelinquencyService.isOverdue(bal.balance(), reference);

        List<NoteDto> notes = noteRepo.findByClientIdOrderByIdDesc(clientId).stream()
                .map(n -> new NoteDto(n.getId(), n.getContent(), n.getCreatedAt())).toList();
        return new ClientProfileDto(client.getId(), client.getName(), client.getSectorId(), sector, client.getPhone(),
                client.getPlaza(), bal.balance(), bal.openingBalance(), bal.billed(), bal.payments().add(bal.deposits()),
                bal.discounts(), packagingService.balances(date).getOrDefault(clientId, 0), billed30, paid30,
                lastPurchase, daysSincePurchase, lastPayment, daysSincePayment, overdue, timeline, hasMore, notes);
    }

    private static String paymentDetail(ClientPaymentEntity p) {
        List<String> parts = new ArrayList<>();
        if (p.getMethod() != null) parts.add(p.getMethod().toLowerCase());
        if (p.getReceivedBy() != null) parts.add("recibió " + p.getReceivedBy());
        if (p.getNote() != null) parts.add(p.getNote());
        return parts.isEmpty() ? null : String.join(" · ", parts);
    }

    private static int rank(String kind) {
        return switch (kind) {
            case "COMPRA" -> 0;
            case "PAGO", "AJUSTE" -> 1;
            default -> 2;
        };
    }

    // ── Datos y notas ────────────────────────────────────────────────────────

    @Transactional
    public void updateClient(Long clientId, String name, Long sectorId, String phone, String plaza) {
        DispatchClientEntity c = clientRepo.findById(clientId).orElseThrow(() -> new BusinessException("Cliente no encontrado"));
        if (name == null || name.isBlank()) throw new BusinessException("El nombre es obligatorio");
        if (sectorId == null || !sectorRepo.existsById(sectorId)) throw new BusinessException("Sector no encontrado");
        c.setName(name.trim());
        c.setSectorId(sectorId);
        c.setPhone(blankToNull(phone));
        c.setPlaza(blankToNull(plaza));
        clientRepo.save(c);
    }

    @Transactional
    public void addNote(Long clientId, String content) {
        if (!clientRepo.existsById(clientId)) throw new BusinessException("Cliente no encontrado");
        if (content == null || content.isBlank()) throw new BusinessException("La nota no puede estar vacía");
        if (content.length() > 1000) throw new BusinessException("La nota es demasiado larga (máximo 1000 caracteres)");
        ClientNoteEntity n = new ClientNoteEntity();
        n.setClientId(clientId);
        n.setContent(content.trim());
        n.setCreatedAt(LocalDateTime.now());
        noteRepo.save(n);
    }

    @Transactional
    public void deleteNote(Long clientId, Long noteId) {
        ClientNoteEntity n = noteRepo.findById(noteId).orElseThrow(() -> new BusinessException("Nota no encontrada"));
        if (!n.getClientId().equals(clientId)) throw new BusinessException("La nota no pertenece a este cliente");
        noteRepo.delete(n);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
