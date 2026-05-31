package com.rappi.farmer.domain.repositories;

import com.rappi.farmer.domain.entities.User;

import java.util.List;
import java.util.Optional;

public interface UserRepository {
    User save(User user);
    Optional<User> findById(Long id);
    List<User> findAll();
}
