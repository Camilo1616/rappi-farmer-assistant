package com.rappi.assistant.infrastructure.persistence.adapter;

import com.rappi.assistant.domain.entities.User;
import com.rappi.assistant.domain.repositories.UserRepository;
import com.rappi.assistant.infrastructure.persistence.entity.UserEntity;
import com.rappi.assistant.infrastructure.persistence.repository.UserJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserRepositoryAdapter implements UserRepository {

    private final UserJpaRepository jpaRepository;

    @Override
    public User save(User user) {
        LocalDateTime createdAt = user.getId() == null
                ? LocalDateTime.now()
                : jpaRepository.findById(user.getId())
                        .map(UserEntity::getCreatedAt)
                        .orElse(LocalDateTime.now());

        UserEntity entity = new UserEntity();
        entity.setId(user.getId());
        entity.setFullName(user.getFullName());
        entity.setEmail(user.getEmail());
        entity.setPassword(user.getPasswordHash());
        entity.setRole(user.getRole());
        entity.setAccountStatus(user.getAccountStatus() != null ? user.getAccountStatus() : "ACTIVE");
        entity.setNickname(user.getNickname());
        entity.setAvatarUrl(user.getAvatarUrl());
        entity.setCreatedAt(createdAt);
        entity.setLastLoginAt(user.getLastLoginAt());
        entity.setLastActivity(user.getLastActivity());
        entity.setActivityStatus(user.getActivityStatus());
        entity.setWhatsappPhoneRegisteredAt(user.getWhatsappPhoneRegisteredAt());

        return toDomain(jpaRepository.save(entity));
    }

    @Override public Optional<User> findById(Long id)          { return jpaRepository.findById(id).map(this::toDomain); }
    @Override public Optional<User> findByEmail(String email)  { return jpaRepository.findByEmail(email).map(this::toDomain); }
    @Override public boolean existsByEmail(String email)        { return jpaRepository.existsByEmail(email); }
    @Override public List<User> findAll()                       { return jpaRepository.findAll().stream().map(this::toDomain).toList(); }
    @Override public List<User> findByRole(String role)        { return jpaRepository.findByRole(role).stream().map(this::toDomain).toList(); }

    private User toDomain(UserEntity e) {
        return new User(
                e.getId(), e.getFullName(), e.getEmail(),
                e.getRole(), e.getPassword(),
                e.getAccountStatus(),
                e.getNickname(), e.getAvatarUrl(), e.getLastLoginAt(),
                e.getLastActivity(), e.getActivityStatus(),
                e.getWhatsappPhoneRegisteredAt());
    }
}
