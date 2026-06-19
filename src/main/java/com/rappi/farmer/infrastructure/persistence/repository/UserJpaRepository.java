package com.rappi.farmer.infrastructure.persistence.repository;

import com.rappi.farmer.infrastructure.persistence.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserJpaRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByEmail(String email);
    List<UserEntity> findByRole(String role);
    List<UserEntity> findByLiderId(Long liderId);
    long countByCountryCode(String countryCode);
    boolean existsByFarmerCode(String farmerCode);
    List<UserEntity> findByCountryCodeAndRole(String countryCode, String role);
    List<UserEntity> findByCalendarRefreshTokenIsNotNull();

    /** Líderes cuyo countryCode contiene el prefijo dado (ej: "MX" captura "MX","MX-CS","MX-NE"). */
    @Query("SELECT u FROM UserEntity u WHERE u.role = 'LIDER' AND u.countryCode LIKE %:prefix%")
    List<UserEntity> findLidersByCountryPrefix(@Param("prefix") String prefix);
}
