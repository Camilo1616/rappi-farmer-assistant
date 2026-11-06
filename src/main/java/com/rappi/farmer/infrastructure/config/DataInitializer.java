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

        // Cuenta de la dueña (despacho de fresas): solo se crea si se definen ambas variables de entorno
        String duenaEmail = System.getenv("DUENA_EMAIL");
        String duenaPassword = System.getenv("DUENA_PASSWORD");
        if (duenaEmail != null && !duenaEmail.isBlank() && duenaPassword != null && !duenaPassword.isBlank()) {
            createPanelUser("Angela", duenaEmail.trim(), duenaPassword, UserRole.DUENA);
        }
        // Cuenta de Lorena (cartera): misma regla, solo si se definen las variables de entorno
        String asistenteEmail = System.getenv("ASISTENTE_EMAIL");
        String asistentePassword = System.getenv("ASISTENTE_PASSWORD");
        if (asistenteEmail != null && !asistenteEmail.isBlank() && asistentePassword != null && !asistentePassword.isBlank()) {
            createPanelUser("Lorena", asistenteEmail.trim(), asistentePassword, UserRole.ASISTENTE);
        }

    }

    /** Cuenta inicial del panel: la contraseña la define quien despliega, así que debe cambiarla en su primer ingreso. */
    private void createPanelUser(String fullName, String email, String password, UserRole role) {
        if (userRepository.findByEmail(email).isPresent()) return;
        createIfNotExists(fullName, email, password, role.name(), "CO");
        userRepository.findByEmail(email.toLowerCase()).ifPresent(u -> {
            u.setMustChangePassword(true);
            userRepository.save(u);
        });
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
