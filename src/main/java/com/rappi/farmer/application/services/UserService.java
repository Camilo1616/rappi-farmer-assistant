package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.CreateUserRequest;
import com.rappi.farmer.application.dtos.FarmerControlDto;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.domain.repositories.UserRepository;
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
    private final StoreRepository storeRepository;
    private final PasswordEncoder encoder;

    /** Autentica al usuario. Lanza BusinessException si las credenciales son incorrectas. */
    public User login(String email, String rawPassword) {
        if (email == null || !email.toLowerCase().endsWith(RAPPI_DOMAIN)) {
            throw new BusinessException("El correo debe ser @rappi.com");
        }
        User user = userRepository.findByEmail(email.toLowerCase())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        if (!encoder.matches(rawPassword, user.getPasswordHash())) {
            throw new BusinessException("Contraseña incorrecta");
        }
        log.info("Login exitoso — {} ({})", user.getFullName(), user.getUserRole());
        return user;
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
        String country = request.getCountryCode() != null
                ? request.getCountryCode().toUpperCase() : "CO";
        String code = generateFarmerCode(country);
        String nickname = request.getNickname() != null && !request.getNickname().isBlank()
                ? request.getNickname().trim() : null;
        User user = new User(null, request.getFullName(),
                request.getEmail().toLowerCase(),
                request.getRole() != null ? request.getRole() : UserRole.FARMER_MASS.name(),
                hash, code, country, "ACTIVE", request.getLiderId(), nickname, null, null);
        User saved = userRepository.save(user);
        log.info("Usuario creado: {} ({})", saved.getEmail(), saved.getRole());
        return saved;
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public List<User> findFarmers() {
        return userRepository.findByRole(UserRole.FARMER_MASS.name());
    }

    public List<User> findFarmersByLider(Long liderId) {
        User lider = userRepository.findById(liderId).orElse(null);
        if (lider == null || lider.getCountryCode() == null || lider.getCountryCode().isBlank()) {
            return List.of();
        }
        java.util.Set<Long> seen = new java.util.HashSet<>();
        List<User> result = new java.util.ArrayList<>();
        for (String country : lider.getCountryCode().split(",")) {
            String c = country.trim();
            if (!c.isBlank()) {
                userRepository.findByCountryCodeAndRole(c, UserRole.FARMER_MASS.name()).stream()
                        .filter(u -> seen.add(u.getId()))
                        .forEach(result::add);
            }
        }
        return result;
    }

    public List<String> getLiderCountries(Long liderId) {
        return userRepository.findById(liderId)
                .map(u -> u.getCountryCode() == null || u.getCountryCode().isBlank()
                        ? new java.util.ArrayList<String>()
                        : java.util.Arrays.asList(u.getCountryCode().split(",")))
                .orElse(new java.util.ArrayList<>());
    }

    public List<User> findLiders() {
        return userRepository.findByRole(UserRole.LIDER.name());
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

    /** Lista de todos los farmers con stats para el control del líder. */
    public List<FarmerControlDto> getFarmerControl() {
        List<User> farmers = userRepository.findByRole(UserRole.FARMER_MASS.name());
        List<User> liders  = userRepository.findByRole(UserRole.LIDER.name());
        return toControlDtos(farmers, liders);
    }

    /** Farmers del equipo del líder: por liderId asignado + por países del líder. */
    public List<FarmerControlDto> getFarmerControlForLider(Long liderId) {
        List<User> farmers = findFarmersByLider(liderId);
        List<User> liders  = userRepository.findByRole(UserRole.LIDER.name());
        return toControlDtos(farmers, liders);
    }

    private List<FarmerControlDto> toControlDtos(List<User> farmers, List<User> liders) {
        return farmers.stream().map(f -> {
            long tiendas = storeRepository.countActiveByUserId(f.getId());
            String liderName = liders.stream()
                    .filter(l -> l.getId().equals(f.getLiderId()))
                    .map(User::getFullName)
                    .findFirst().orElse("—");
            return new FarmerControlDto(f.getId(), f.getFullName(), f.getFarmerCode(),
                    f.getEmail(), f.getCountryCode(), f.getAccountStatus(),
                    f.getLiderId(), liderName, tiendas);
        }).toList();
    }

    @Transactional
    public void updateFarmer(Long farmerId, String countryCode, Long newLiderId) {
        User user = userRepository.findById(farmerId)
                .orElseThrow(() -> new BusinessException("Farmer no encontrado: " + farmerId));
        if (countryCode != null && !countryCode.isBlank()) user.setCountryCode(countryCode.toUpperCase());
        if (newLiderId != null) user.setLiderId(newLiderId);
        userRepository.save(user);
        log.info("Farmer {} actualizado — país:{} líder:{}", user.getEmail(), countryCode, newLiderId);
    }

    /** Genera código único por país: CO0001, PE0042, MX0100, etc. */
    public String generateFarmerCode(String countryCode) {
        String upper = (countryCode != null ? countryCode : "CO").toUpperCase();
        long base = userRepository.countByCountryCode(upper);
        String code = upper + String.format("%04d", base + 1);
        while (userRepository.existsByFarmerCode(code)) {
            base++;
            code = upper + String.format("%04d", base + 1);
        }
        return code;
    }
}
