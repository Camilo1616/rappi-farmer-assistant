package com.rappi.farmer.infrastructure.persistence.adapter;

import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.infrastructure.persistence.entity.UserEntity;
import com.rappi.farmer.infrastructure.persistence.repository.UserJpaRepository;
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
        entity.setFarmerCode(user.getFarmerCode());
        entity.setCountryCode(user.getCountryCode());
        entity.setAccountStatus(user.getAccountStatus() != null ? user.getAccountStatus() : "ACTIVE");
        entity.setLiderId(user.getLiderId());
        entity.setNickname(user.getNickname());
        entity.setAvatarUrl(user.getAvatarUrl());
        entity.setCalendarRefreshToken(user.getCalendarRefreshToken());
        entity.setCreatedAt(createdAt);

        return toDomain(jpaRepository.save(entity));
    }

    @Override public Optional<User> findById(Long id)          { return jpaRepository.findById(id).map(this::toDomain); }
    @Override public Optional<User> findByEmail(String email)  { return jpaRepository.findByEmail(email).map(this::toDomain); }
    @Override public boolean existsByEmail(String email)        { return jpaRepository.existsByEmail(email); }
    @Override public List<User> findAll()                       { return jpaRepository.findAll().stream().map(this::toDomain).toList(); }
    @Override public List<User> findByRole(String role)        { return jpaRepository.findByRole(role).stream().map(this::toDomain).toList(); }
    @Override public List<User> findByLiderId(Long liderId)    { return jpaRepository.findByLiderId(liderId).stream().map(this::toDomain).toList(); }
    @Override public long countByCountryCode(String code)      { return jpaRepository.countByCountryCode(code); }
    @Override public boolean existsByFarmerCode(String code)   { return jpaRepository.existsByFarmerCode(code); }
    @Override public List<User> findByCountryCodeAndRole(String countryCode, String role) {
        return jpaRepository.findByCountryCodeAndRole(countryCode, role).stream().map(this::toDomain).toList();
    }
    @Override public List<User> findByCalendarRefreshTokenIsNotNull() {
        return jpaRepository.findByCalendarRefreshTokenIsNotNull().stream().map(this::toDomain).toList();
    }

    private User toDomain(UserEntity e) {
        return new User(
                e.getId(), e.getFullName(), e.getEmail(),
                e.getRole(), e.getPassword(),
                e.getFarmerCode(), e.getCountryCode(),
                e.getAccountStatus(), e.getLiderId(),
                e.getNickname(), e.getAvatarUrl(), e.getCalendarRefreshToken());
    }
}
