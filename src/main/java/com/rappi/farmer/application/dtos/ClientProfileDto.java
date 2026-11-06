package com.rappi.farmer.application.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Ficha completa de un cliente (vista tipo CRM): contacto, estado de cuenta, actividad e historial. */
public record ClientProfileDto(Long id, String name, Long sectorId, String sector, String phone, String plaza,
                               BigDecimal balance, BigDecimal openingBalance, BigDecimal billed, BigDecimal paid,
                               BigDecimal discounts, int packaging, BigDecimal billed30, BigDecimal paid30,
                               LastPurchaseDto lastPurchase, Integer daysSincePurchase,
                               LastPaymentDto lastPayment, Integer daysSincePayment, boolean overdue,
                               List<MovementDto> timeline, boolean hasMore, List<NoteDto> notes) {

    public record LastPurchaseDto(LocalDate date, int boxes, BigDecimal total) {}

    public record LastPaymentDto(LocalDate date, String label, BigDecimal amount) {}

    /** kind: COMPRA | PAGO | AJUSTE (descuento o faltante) | VACIAS. amount en pesos; boxes solo en vacias/compras. */
    public record MovementDto(LocalDate date, String kind, String title, String detail, BigDecimal amount, Integer boxes) {}

    public record NoteDto(Long id, String content, LocalDateTime createdAt) {}
}
