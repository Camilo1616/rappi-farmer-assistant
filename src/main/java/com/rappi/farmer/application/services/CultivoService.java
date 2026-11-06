package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.CultivoDayDto;
import com.rappi.farmer.application.dtos.CultivoDayDto.*;
import com.rappi.farmer.domain.enums.FruitCategory;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Cultivos: cada uno tiene un precio de compra por categoria. Lo que entra cada dia se
 * guarda con el precio vigente ese dia (un cambio de precio no altera dias anteriores)
 * y suma automaticamente al stock de la categoria.
 */
@Service
@RequiredArgsConstructor
public class CultivoService {

    private final CropJpaRepository cropRepo;
    private final CropPriceJpaRepository priceRepo;
    private final CropIntakeJpaRepository intakeRepo;
    private final DispatchService dispatchService;

    @Transactional(readOnly = true)
    public CultivoDayDto getDay(LocalDate date) {
        Map<Long, List<CropIntakeEntity>> byCrop = new HashMap<>();
        for (CropIntakeEntity i : intakeRepo.findByDay(date)) {
            byCrop.computeIfAbsent(i.getCropId(), k -> new ArrayList<>()).add(i);
        }
        List<CropDto> crops = new ArrayList<>();
        int totalBoxes = 0;
        BigDecimal totalCost = BigDecimal.ZERO;
        for (CropEntity c : cropRepo.findByActiveTrueOrderByNameAsc()) {
            Map<String, BigDecimal> prices = new LinkedHashMap<>();
            for (FruitCategory f : FruitCategory.values()) prices.put(f.name(), BigDecimal.ZERO);
            priceRepo.findByCropId(c.getId()).forEach(p -> prices.put(p.getCategory(), p.getPrice()));

            List<IntakeDto> intakes = new ArrayList<>();
            int boxes = 0;
            BigDecimal cost = BigDecimal.ZERO;
            for (CropIntakeEntity i : byCrop.getOrDefault(c.getId(), List.of())) {
                intakes.add(new IntakeDto(i.getCategory(), i.getBoxes(), i.getUnitPrice()));
                boxes += i.getBoxes();
                cost = cost.add(i.getUnitPrice().multiply(BigDecimal.valueOf(i.getBoxes())));
            }
            crops.add(new CropDto(c.getId(), c.getName(), prices, intakes, boxes, cost));
            totalBoxes += boxes;
            totalCost = totalCost.add(cost);
        }
        return new CultivoDayDto(date, crops, totalBoxes, totalCost);
    }

    @Transactional
    public CropEntity createCrop(String name) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) throw new BusinessException("El nombre del cultivo es obligatorio");
        CropEntity c = new CropEntity();
        c.setName(n);
        c.setActive(true);
        return cropRepo.save(c);
    }

    @Transactional
    public void setPrice(Long cropId, FruitCategory category, BigDecimal price) {
        if (price == null || price.signum() < 0) throw new BusinessException("El precio no puede ser negativo");
        requireCrop(cropId);
        CropPriceEntity p = priceRepo.findByCropIdAndCategory(cropId, category.name()).orElseGet(() -> {
            CropPriceEntity n = new CropPriceEntity();
            n.setCropId(cropId);
            n.setCategory(category.name());
            return n;
        });
        p.setPrice(price);
        priceRepo.save(p);
    }

    /** Fija las cajas recibidas de un cultivo en una categoria y dia (0 = borra el registro). */
    @Transactional
    public void setIntake(LocalDate date, Long cropId, FruitCategory category, int boxes) {
        if (boxes < 0) throw new BusinessException("La cantidad de cajas no puede ser negativa");
        requireCrop(cropId);
        Optional<CropIntakeEntity> existing = intakeRepo.findByDayAndCropIdAndCategory(date, cropId, category.name());
        if (boxes == 0) {
            existing.ifPresent(intakeRepo::delete);
        } else {
            CropIntakeEntity i = existing.orElseGet(() -> {
                CropIntakeEntity n = new CropIntakeEntity();
                n.setDay(date);
                n.setCropId(cropId);
                n.setCategory(category.name());
                // Precio congelado al crear el registro del dia
                n.setUnitPrice(priceRepo.findByCropIdAndCategory(cropId, category.name())
                        .map(CropPriceEntity::getPrice).orElse(BigDecimal.ZERO));
                return n;
            });
            i.setBoxes(boxes);
            intakeRepo.save(i);
        }
        dispatchService.assertSupplyChangeKeepsStockValid(date, category);
    }

    private void requireCrop(Long cropId) {
        if (!cropRepo.existsById(cropId)) throw new BusinessException("Cultivo no encontrado");
    }
}
