package com.rappi.assistant.infrastructure.config;

import com.rappi.assistant.application.dtos.CreateUserRequest;
import com.rappi.assistant.application.services.UserService;
import com.rappi.assistant.domain.enums.UserRole;
import com.rappi.assistant.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Crea un usuario admin por defecto si la tabla está vacía.
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
            createIfNotExists("Cristian Ariza", "cristian@rappi.com", "rappi123", UserRole.ADMIN.name());
        }
    }

    private void createIfNotExists(String fullName, String email, String password, String role) {
        if (userRepository.findByEmail(email).isPresent()) return;
        CreateUserRequest req = new CreateUserRequest();
        req.setFullName(fullName);
        req.setEmail(email);
        req.setPassword(password);
        req.setRole(role);
        userService.createUser(req);
        log.info("Usuario creado: {} ({})", email, role);
    }
}
