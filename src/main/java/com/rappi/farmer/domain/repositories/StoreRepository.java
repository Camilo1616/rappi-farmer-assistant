package com.rappi.farmer.domain.repositories;

import com.rappi.farmer.domain.entities.Store;

import java.util.List;
import java.util.Optional;

public interface StoreRepository {
    Store save(Store store);
    Optional<Store> findByStoreCode(String storeCode);
    Optional<Store> findById(Long id);
    List<Store> findAll();
    List<Store> findActive();
    List<Store> searchByCodeOrName(String query);
}
