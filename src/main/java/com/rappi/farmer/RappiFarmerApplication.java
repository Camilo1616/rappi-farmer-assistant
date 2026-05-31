package com.rappi.farmer;

import javafx.application.Application;
import javafx.application.Platform;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.stage.Stage;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * Punto de entrada: combina JavaFX (Application) con Spring Boot.
 *
 * Flujo de arranque:
 *   1. JavaFX llama a init()  → Spring levanta su contexto (JPA, beans, etc.)
 *   2. JavaFX llama a start() → se carga el FXML principal
 *   3. Al cerrar, stop()      → Spring cierra sus recursos (conexiones BD, etc.)
 *
 * La clave del patrón: loader.setControllerFactory(springContext::getBean)
 * permite que Spring inyecte dependencias dentro de los Controllers de JavaFX.
 */
public class RappiFarmerApplication extends Application {

    private ConfigurableApplicationContext springContext;

    public static void main(String[] args) {
        launch(args);
    }

    @Override
    public void init() throws Exception {
        springContext = new SpringApplicationBuilder(AppConfig.class)
                .headless(false)
                .run();
    }

    @Override
    public void start(Stage primaryStage) throws Exception {
        FXMLLoader loader = new FXMLLoader(getClass().getResource("/fxml/main.fxml"));
        loader.setControllerFactory(springContext::getBean);
        Parent root = loader.load();

        primaryStage.setTitle("Rappi Farmer Assistant");
        primaryStage.setScene(new Scene(root, 1280, 720));
        primaryStage.setMinWidth(1024);
        primaryStage.setMinHeight(600);
        primaryStage.show();
    }

    @Override
    public void stop() throws Exception {
        springContext.close();
        Platform.exit();
    }
}
