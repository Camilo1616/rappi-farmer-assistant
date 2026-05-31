package com.rappi.farmer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Verifica que el contexto de Spring levanta correctamente
 * (base de datos conectada, todos los beans configurados).
 *
 * Nota: usa AppConfig como clase base, no RappiFarmerApplication,
 * para evitar que los tests intenten lanzar la UI de JavaFX.
 */
@SpringBootTest(classes = AppConfig.class)
class RappiFarmerApplicationTests {

    @Test
    void contextLoads() {
    }
}
