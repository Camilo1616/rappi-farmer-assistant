package com.rappi.farmer.domain.repositories;

import com.rappi.farmer.domain.entities.PriorityBase;
import com.rappi.farmer.domain.entities.PriorityBaseAssignment;
import com.rappi.farmer.domain.entities.PriorityBaseStore;

import java.util.List;
import java.util.Optional;

public interface PriorityBaseRepository {
    PriorityBase saveBase(PriorityBase base);
    PriorityBaseAssignment saveAssignment(PriorityBaseAssignment assignment);
    PriorityBaseStore saveBaseStore(PriorityBaseStore bs);

    Optional<PriorityBase> findBaseById(Long id);
    List<PriorityBase> findBasesByLider(Long liderId);
    List<PriorityBaseAssignment> findAssignmentsByBase(Long baseId);
    List<PriorityBaseAssignment> findPendingByFarmer(Long farmerId);
    List<PriorityBaseAssignment> findAllByFarmer(Long farmerId);
    Optional<PriorityBaseAssignment> findAssignmentById(Long id);

    List<PriorityBaseStore> findStoresByBaseAndFarmer(Long baseId, Long farmerId);
    List<PriorityBaseStore> findStoresByBase(Long baseId);
    long countStoresByBaseAndFarmer(Long baseId, Long farmerId);
    long countManagedByBaseAndFarmer(Long baseId, Long farmerId);
    Optional<PriorityBaseStore> findBaseStoreById(Long id);

    void deleteBase(Long baseId);
}
