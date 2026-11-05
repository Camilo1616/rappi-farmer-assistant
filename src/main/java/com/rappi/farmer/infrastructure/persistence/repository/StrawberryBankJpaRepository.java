package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.StrawberryBankEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface StrawberryBankJpaRepository extends JpaRepository<StrawberryBankEntity, Long> {

    /** Bloqueo pesimista para que dos pedidos simultáneos no descuenten el mismo stock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from StrawberryBankEntity b where b.id = :id")
    Optional<StrawberryBankEntity> findForUpdate(Long id);
}
