package com.rappi.farmer.infrastructure.config;

import com.rappi.farmer.application.dtos.CreateUserRequest;
import com.rappi.farmer.application.services.UserService;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Crea usuarios por defecto si la tabla está vacía.
 * Contraseña inicial: rappi123 (cambiar en producción).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final UserService userService;

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.findAll().isEmpty()) {
            log.info("No hay usuarios — creando usuario por defecto");
            createIfNotExists("Cristian Ariza", "cristian@rappi.com", "rappi123", UserRole.FARMER_MASS.name(), "CO");
        }
        // Farmers de prueba — se crean si no existen
        createIfNotExists("Valentina Rios",  "valentina.rios@rappi.com",  "rappi2025", UserRole.FARMER_MASS.name(), "CO");
        createIfNotExists("Andres Moreno",   "andres.moreno@rappi.com",   "rappi2025", UserRole.FARMER_MASS.name(), "CO");
        createIfNotExists("Camila Herrera",  "camila.herrera@rappi.com",  "rappi2025", UserRole.FARMER_MASS.name(), "CO");

    }

    private void createIfNotExists(String fullName, String email, String password, String role, String country) {
        if (userRepository.findByEmail(email).isPresent()) return;
        CreateUserRequest req = new CreateUserRequest();
        req.setFullName(fullName);
        req.setEmail(email);
        req.setPassword(password);
        req.setRole(role);
        req.setCountryCode(country);
        userService.createUser(req);
        log.info("Usuario creado: {} ({})", email, role);
    }
}
