package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.entities.PriorityBase;
import com.rappi.farmer.domain.entities.PriorityBaseAssignment;
import com.rappi.farmer.domain.entities.PriorityBaseStore;
import com.rappi.farmer.domain.repositories.PriorityBaseRepository;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
@Transactional
public class PriorityBaseRepositoryAdapter implements PriorityBaseRepository {

    private final PriorityBaseJpaRepository baseJpa;
    private final PriorityBaseAssignmentJpaRepository assignmentJpa;
    private final PriorityBaseStoreJpaRepository baseStoreJpa;
    private final UserJpaRepository userJpa;
    private final StoreJpaRepository storeJpa;

    @Override
    public PriorityBase saveBase(PriorityBase base) {
        UserEntity lider = userJpa.findById(base.getLiderId())
                .orElseThrow(() -> new IllegalArgumentException("Líder no encontrado: " + base.getLiderId()));
        PriorityBaseEntity entity = new PriorityBaseEntity(
                base.getId(), lider, base.getBaseType(), base.getMessage(), base.getCreatedAt());
        return toDomain(baseJpa.save(entity));
    }

    @Override
    public PriorityBaseAssignment saveAssignment(PriorityBaseAssignment a) {
        PriorityBaseEntity base = baseJpa.findById(a.getBaseId())
                .orElseThrow(() -> new IllegalArgumentException("Base no encontrada: " + a.getBaseId()));
        UserEntity farmer = userJpa.findById(a.getFarmerId())
                .orElseThrow(() -> new IllegalArgumentException("Farmer no encontrado: " + a.getFarmerId()));
        PriorityBaseAssignmentEntity entity = new PriorityBaseAssignmentEntity(
                a.getId(), base, farmer, a.getStatus(), a.getComments(), a.getReadAt(), a.getCompletedAt());
        return toDomain(assignmentJpa.save(entity));
    }

    @Override
    public PriorityBaseStore saveBaseStore(PriorityBaseStore bs) {
        PriorityBaseEntity base = baseJpa.findById(bs.getBaseId())
                .orElseThrow(() -> new IllegalArgumentException("Base no encontrada: " + bs.getBaseId()));
        UserEntity farmer = userJpa.findById(bs.getFarmerId())
                .orElseThrow(() -> new IllegalArgumentException("Farmer no encontrado: " + bs.getFarmerId()));
        StoreEntity store = storeJpa.findById(bs.getStoreId())
                .orElseThrow(() -> new IllegalArgumentException("Tienda no encontrada: " + bs.getStoreId()));
        PriorityBaseStoreEntity entity = new PriorityBaseStoreEntity(
                bs.getId(), base, farmer, store, bs.getStatus(), bs.getManagementType(), bs.getComments(), bs.getManagedAt());
        return toDomain(baseStoreJpa.save(entity));
    }

    @Override
    public Optional<PriorityBase> findBaseById(Long id) {
        return baseJpa.findById(id).map(this::toDomain);
    }

    @Override
    public List<PriorityBase> findBasesByLider(Long liderId) {
        return baseJpa.findByLiderId(liderId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<PriorityBaseAssignment> findAssignmentsByBase(Long baseId) {
        return assignmentJpa.findByBaseId(baseId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<PriorityBaseAssignment> findPendingByFarmer(Long farmerId) {
        return assignmentJpa.findPendingByFarmerId(farmerId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<PriorityBaseAssignment> findAllByFarmer(Long farmerId) {
        return assignmentJpa.findAllByFarmerId(farmerId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<PriorityBaseAssignment> findAssignmentById(Long id) {
        return assignmentJpa.findById(id).map(this::toDomain);
    }

    @Override
    public List<PriorityBaseStore> findStoresByBaseAndFarmer(Long baseId, Long farmerId) {
        return baseStoreJpa.findByBaseAndFarmer(baseId, farmerId).stream().map(this::toDomain).toList();
    }

    @Override
    public List<PriorityBaseStore> findStoresByBase(Long baseId) {
        return baseStoreJpa.findByBase(baseId).stream().map(this::toDomain).toList();
    }

    @Override
    public long countStoresByBaseAndFarmer(Long baseId, Long farmerId) {
        return baseStoreJpa.countByBaseAndFarmer(baseId, farmerId);
    }

    @Override
    public long countManagedByBaseAndFarmer(Long baseId, Long farmerId) {
        return baseStoreJpa.countManagedByBaseAndFarmer(baseId, farmerId);
    }

    @Override
    public Optional<PriorityBaseStore> findBaseStoreById(Long id) {
        return baseStoreJpa.findById(id).map(this::toDomain);
    }

    @Override
    public void deleteBase(Long baseId) {
        baseStoreJpa.deleteByBaseId(baseId);
        assignmentJpa.deleteByBaseId(baseId);
        baseJpa.deleteById(baseId);
    }

    // ── toDomain ──

    private PriorityBase toDomain(PriorityBaseEntity e) {
        return new PriorityBase(e.getId(), e.getLider().getId(), e.getLider().getFullName(),
                e.getBaseType(), e.getMessage(), e.getCreatedAt());
    }

    private PriorityBaseAssignment toDomain(PriorityBaseAssignmentEntity e) {
        return new PriorityBaseAssignment(
                e.getId(), e.getBase().getId(),
                e.getFarmer().getId(), e.getFarmer().getFullName(), e.getFarmer().getFarmerCode(),
                e.getStatus(), e.getComments(), e.getReadAt(), e.getCompletedAt());
    }

    private PriorityBaseStore toDomain(PriorityBaseStoreEntity e) {
        return new PriorityBaseStore(
                e.getId(), e.getBase().getId(),
                e.getFarmer().getId(), e.getFarmer().getFullName(),
                e.getStore().getId(), e.getStore().getStoreCode(), e.getStore().getStoreName(),
                e.getStore().getPhoneNumber(), e.getStore().getCurrentStatus(),
                e.getStatus(), e.getManagementType(), e.getComments(), e.getManagedAt());
    }
}
