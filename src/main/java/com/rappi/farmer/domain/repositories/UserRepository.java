package com.rappi.farmer.domain.repositories;

import com.rappi.farmer.domain.entities.User;

import java.util.List;
import java.util.Optional;

public interface UserRepository {
    User save(User user);
    Optional<User> findById(Long id);
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findAll();
    List<User> findByRole(String role);
    List<User> findByLiderId(Long liderId);
    long countByCountryCode(String countryCode);
    boolean existsByFarmerCode(String farmerCode);
    List<User> findByCountryCodeAndRole(String countryCode, String role);
    List<User> findByCalendarRefreshTokenIsNotNull();
}
