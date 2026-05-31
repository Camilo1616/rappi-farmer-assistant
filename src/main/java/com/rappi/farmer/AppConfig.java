package com.rappi.farmer;

import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Configuración de Spring Boot separada de la clase JavaFX Application.
 * Esto permite que @SpringBootTest en los tests cargue el contexto
 * sin intentar lanzar la interfaz gráfica.
 */
@SpringBootApplication
public class AppConfig {
}
