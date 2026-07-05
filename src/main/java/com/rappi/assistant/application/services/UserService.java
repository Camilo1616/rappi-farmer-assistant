package com.rappi.assistant.application.services;

import com.rappi.assistant.application.dtos.CreateUserRequest;
import com.rappi.assistant.domain.entities.User;
import com.rappi.assistant.domain.enums.UserRole;
import com.rappi.assistant.domain.exceptions.BusinessException;
import com.rappi.assistant.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private static final String RAPPI_DOMAIN = "@rappi.com";

    private final UserRepository userRepository;
    private final PasswordEncoder encoder;

    public record LoginResult(User user) {}

    /** Autentica al usuario. Lanza BusinessException si las credenciales son incorrectas. */
    public LoginResult login(String email, String rawPassword) {
        if (email == null || !email.toLowerCase().endsWith(RAPPI_DOMAIN)) {
            throw new BusinessException("El correo debe ser @rappi.com");
        }
        User user = userRepository.findByEmail(email.toLowerCase())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        if (!encoder.matches(rawPassword, user.getPasswordHash())) {
            throw new BusinessException("Contraseña incorrecta");
        }
        updateLastLogin(user);
        log.info("Login exitoso — {} ({})", user.getFullName(), user.getUserRole());
        return new LoginResult(user);
    }

    @Transactional
    protected void updateLastLogin(User user) {
        user.setLastLoginAt(java.time.LocalDateTime.now());
        userRepository.save(user);
    }

    @Transactional
    public User createUser(CreateUserRequest request) {
        if (!request.getEmail().toLowerCase().endsWith(RAPPI_DOMAIN)) {
            throw new BusinessException("El correo debe ser @rappi.com");
        }
        if (userRepository.existsByEmail(request.getEmail().toLowerCase())) {
            throw new BusinessException("Ya existe un usuario con ese correo");
        }
        String hash = encoder.encode(request.getPassword());
        String nickname = request.getNickname() != null && !request.getNickname().isBlank()
                ? request.getNickname().trim() : null;
        User user = new User(null, request.getFullName(),
                request.getEmail().toLowerCase(),
                request.getRole() != null ? request.getRole() : UserRole.USER.name(),
                hash, "ACTIVE", nickname, null, null, null, null, null);
        User saved = userRepository.save(user);
        log.info("Usuario creado: {} ({})", saved.getEmail(), saved.getRole());
        return saved;
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    @Transactional
    public User updateStatus(Long userId, String newStatus) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado: " + userId));
        user.setAccountStatus(newStatus);
        User updated = userRepository.save(user);
        log.info("Estado de usuario {} actualizado a {}", user.getEmail(), newStatus);
        return updated;
    }

    public java.util.Optional<User> findUserById(Long id) {
        return userRepository.findById(id);
    }

    public Long findIdByEmail(String email) {
        return userRepository.findByEmail(email)
                .map(User::getId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado: " + email));
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email.toLowerCase().trim());
    }

    @Transactional
    public void resetPassword(String email, String newPassword) {
        User user = userRepository.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        user.setPasswordHash(encoder.encode(newPassword));
        userRepository.save(user);
        log.info("Contraseña reseteada para {}", email);
    }

    /** Registra latido de actividad del usuario y lo marca como ACTIVO. */
    public void heartbeat(Long userId) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setLastActivity(java.time.LocalDateTime.now());
            u.setActivityStatus("ACTIVO");
            userRepository.save(u);
        });
    }

    /** Marca al usuario como DESACTIVADO al cerrar sesión. */
    public void markLogout(Long userId) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setActivityStatus("DESACTIVADO");
            userRepository.save(u);
        });
    }

    @Transactional
    public void setWhatsappPhoneRegisteredAt(Long userId, java.time.LocalDate registeredAt) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        user.setWhatsappPhoneRegisteredAt(registeredAt);
        userRepository.save(user);
        log.info("WA phone age actualizada para userId={} → registeredAt={}", userId, registeredAt);
    }

    /** Tarea programada: marca INACTIVO a usuarios sin actividad en las últimas 2 horas. */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 600_000)
    public void markInactiveUsers() {
        java.time.LocalDateTime threshold = java.time.LocalDateTime.now().minusHours(2);
        userRepository.findAll().stream()
            .filter(u -> "ACTIVO".equals(u.getActivityStatus())
                         && u.getLastActivity() != null
                         && u.getLastActivity().isBefore(threshold))
            .forEach(u -> {
                u.setActivityStatus("INACTIVO");
                userRepository.save(u);
                log.info("Usuario {} marcado INACTIVO — última actividad: {}", u.getEmail(), u.getLastActivity());
            });
    }
}
