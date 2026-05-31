package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.infrastructure.persistence.entity.UserEntity;
import com.rappi.farmer.infrastructure.persistence.repository.UserJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserRepositoryAdapter implements UserRepository {

    private final UserJpaRepository jpaRepository;

    @Override
    public User save(User user) {
        UserEntity entity = new UserEntity(null, user.getFullName(), user.getEmail(), null, user.getRole(), null);
        UserEntity saved = jpaRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<User> findById(Long id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public List<User> findAll() {
        return jpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    private User toDomain(UserEntity e) {
        return new User(e.getId(), e.getFullName(), e.getEmail(), e.getRole());
    }
}
