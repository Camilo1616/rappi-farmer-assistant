package com.rappi.farmer.application.services;

import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.exceptions.InsufficientStrawberriesException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Ventas, pedidos, banco de fresas y cultivos.
 * Regla clave: un pedido solo se crea si el banco tiene fresas suficientes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SalesService {

    public static final String PENDIENTE = "PENDIENTE";
    public static final String CONFIRMADA = "CONFIRMADA";
    public static final String PEDIDO_CREADO = "PEDIDO_CREADO";

    private final SaleJpaRepository saleRepo;
    private final SaleOrderJpaRepository orderRepo;
    private final CropJpaRepository cropRepo;
    private final StrawberryBankJpaRepository bankRepo;

    // ── Ventas ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SaleEntity> listSales() {
        return saleRepo.findAll().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();
    }

    @Transactional
    public SaleEntity createSale(String customerName, BigDecimal quantityKg) {
        requirePositive(quantityKg);
        SaleEntity sale = new SaleEntity();
        sale.setCustomerName(customerName.trim());
        sale.setQuantityKg(quantityKg);
        sale.setStatus(PENDIENTE);
        sale.setCreatedAt(LocalDateTime.now());
        return saleRepo.save(sale);
    }

    @Transactional
    public SaleEntity confirmSale(Long saleId) {
        SaleEntity sale = getSale(saleId);
        if (!PENDIENTE.equals(sale.getStatus())) {
            throw new BusinessException("Solo se puede confirmar una venta pendiente");
        }
        sale.setStatus(CONFIRMADA);
        return saleRepo.save(sale);
    }

    /** Asigna un cultivo a la venta (opcional, para trazabilidad). */
    @Transactional
    public SaleEntity assignCrop(Long saleId, Long cropId) {
        SaleEntity sale = getSale(saleId);
        cropRepo.findById(cropId).orElseThrow(() -> new BusinessException("Cultivo no encontrado"));
        sale.setCropId(cropId);
        return saleRepo.save(sale);
    }

    /**
     * Crea el pedido de una venta confirmada y descuenta el banco.
     * Si no alcanza el stock lanza {@link InsufficientStrawberriesException}
     * y no cambia nada (la transacción se revierte).
     */
    @Transactional
    public SaleOrderEntity createOrder(Long saleId) {
        SaleEntity sale = getSale(saleId);
        if (!CONFIRMADA.equals(sale.getStatus())) {
            throw new BusinessException("La venta debe estar confirmada antes de crear el pedido");
        }
        StrawberryBankEntity bank = lockedBank();
        if (bank.getQuantityKg().compareTo(sale.getQuantityKg()) < 0) {
            log.warn("Pedido rechazado venta={} requerido={} disponible={}",
                    saleId, sale.getQuantityKg(), bank.getQuantityKg());
            throw new InsufficientStrawberriesException();
        }
        bank.setQuantityKg(bank.getQuantityKg().subtract(sale.getQuantityKg()));
        bank.setUpdatedAt(LocalDateTime.now());
        bankRepo.save(bank);

        SaleOrderEntity order = new SaleOrderEntity();
        order.setSaleId(saleId);
        order.setQuantityKg(sale.getQuantityKg());
        order.setCreatedAt(LocalDateTime.now());
        sale.setStatus(PEDIDO_CREADO);
        saleRepo.save(sale);
        return orderRepo.save(order);
    }

    // ── Banco y cultivos ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public BigDecimal bankQuantity() {
        return bankRepo.findById(StrawberryBankEntity.SINGLETON_ID)
                .map(StrawberryBankEntity::getQuantityKg).orElse(BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public List<CropEntity> listCrops() {
        return cropRepo.findAll();
    }

    @Transactional
    public CropEntity createCrop(String name, String location) {
        CropEntity crop = new CropEntity();
        crop.setName(name.trim());
        crop.setLocation(location == null || location.isBlank() ? null : location.trim());
        crop.setCreatedAt(LocalDateTime.now());
        return cropRepo.save(crop);
    }

    @Transactional
    public void deleteCrop(Long cropId) {
        // Las ventas ligadas a este cultivo quedan sin asignar
        saleRepo.findAll().stream().filter(s -> cropId.equals(s.getCropId()))
                .forEach(s -> { s.setCropId(null); saleRepo.save(s); });
        cropRepo.deleteById(cropId);
    }

    /** Registra una cosecha: suma al cultivo y al banco. */
    @Transactional
    public CropEntity harvest(Long cropId, BigDecimal kg) {
        requirePositive(kg);
        CropEntity crop = cropRepo.findById(cropId)
                .orElseThrow(() -> new BusinessException("Cultivo no encontrado"));
        crop.setHarvestedKg(crop.getHarvestedKg().add(kg));
        StrawberryBankEntity bank = lockedBank();
        bank.setQuantityKg(bank.getQuantityKg().add(kg));
        bank.setUpdatedAt(LocalDateTime.now());
        bankRepo.save(bank);
        return cropRepo.save(crop);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private StrawberryBankEntity lockedBank() {
        return bankRepo.findForUpdate(StrawberryBankEntity.SINGLETON_ID)
                .orElseThrow(() -> new BusinessException("Banco de fresas no inicializado"));
    }

    private SaleEntity getSale(Long id) {
        return saleRepo.findById(id).orElseThrow(() -> new BusinessException("Venta no encontrada"));
    }

    private void requirePositive(BigDecimal kg) {
        if (kg == null || kg.signum() <= 0) {
            throw new BusinessException("La cantidad debe ser mayor a cero");
        }
    }
}
