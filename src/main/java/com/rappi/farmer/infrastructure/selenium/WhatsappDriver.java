package com.rappi.farmer.infrastructure.selenium;

import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

/**
 * Controla WhatsApp Web via Selenium.
 * Guarda la sesión en un perfil de Chrome para no escanear QR cada vez.
 */
@Slf4j
@Component
public class WhatsappDriver {

    private static final String WA_URL = "https://web.whatsapp.com";
    private static final String SESSION_DIR = System.getProperty("user.home") + "\\rappi-wa-session";

    // Selectores de WhatsApp Web
    private static final By CHAT_LIST   = By.cssSelector("[data-testid='chat-list']");
    private static final By INTRO_TITLE = By.cssSelector("[data-testid='intro-title']");
    private static final By POPUP_OK    = By.cssSelector("[data-testid='popup-controls-ok']");

    // El input de mensaje — múltiples selectores por si WhatsApp cambia el DOM
    private static final List<By> MSG_INPUT_SELECTORS = List.of(
            By.cssSelector("[data-testid='conversation-compose-box-input']"),
            By.cssSelector("div[contenteditable='true'][data-tab='10']"),
            By.cssSelector("div[contenteditable='true'][data-tab='6']"),
            By.cssSelector("footer div[contenteditable='true']")
    );

    private WebDriver driver;

    /** Abre Chrome con el perfil guardado. */
    public void abrir() {
        // Si ya hay driver pero Chrome fue cerrado externamente, limpiarlo primero
        if (driver != null && !verificarEstadoReal()) {
            driver = null;
        }
        if (driver != null) return;

        log.info("Abriendo Chrome con perfil en: {}", SESSION_DIR);
        limpiarLock();

        ChromeOptions options = new ChromeOptions();
        options.addArguments("--user-data-dir=" + SESSION_DIR);
        options.addArguments("--profile-directory=Default");
        options.addArguments("--no-first-run");
        options.addArguments("--no-default-browser-check");
        options.addArguments("--disable-gpu");
        options.addArguments("--disable-blink-features=AutomationControlled");
        options.addArguments("--remote-allow-origins=*");
        options.setExperimentalOption("excludeSwitches", new String[]{"enable-automation"});

        driver = new ChromeDriver(options);
        log.info("ChromeDriver iniciado, navegando a WhatsApp Web");
        driver.get(WA_URL);
        log.info("URL actual: {}", driver.getCurrentUrl());
    }

    /** Borra el SingletonLock que Chrome deja si se cierra abruptamente. */
    private void limpiarLock() {
        try {
            Path lock = Path.of(SESSION_DIR, "SingletonLock");
            if (Files.deleteIfExists(lock)) {
                log.info("SingletonLock eliminado — sesión anterior no cerró correctamente");
            }
        } catch (IOException e) {
            log.warn("No se pudo eliminar SingletonLock: {}", e.getMessage());
        }
    }

    /**
     * Espera a que WhatsApp Web muestre la lista de chats (sesión activa).
     * Devuelve true si está listo, false si venció el timeout (usuario debe escanear QR).
     */
    public boolean esperarConexion(int timeoutSegundos) {
        try {
            new WebDriverWait(driver, Duration.ofSeconds(timeoutSegundos))
                    .until(ExpectedConditions.or(
                            ExpectedConditions.presenceOfElementLocated(CHAT_LIST),
                            ExpectedConditions.presenceOfElementLocated(INTRO_TITLE)
                    ));

            // Si está la lista de chats, ya está conectado
            return !driver.findElements(CHAT_LIST).isEmpty();
        } catch (Exception e) {
            log.warn("Timeout esperando conexión WhatsApp", e);
            return false;
        }
    }

    /** Verifica si la sesión sigue activa (chat list visible). */
    public boolean estaConectado() {
        try {
            return driver != null && !driver.findElements(CHAT_LIST).isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Envía un mensaje a un número de teléfono.
     * Usa Enter en el input en lugar de buscar el botón (más estable entre versiones de WA Web).
     *
     * @return "ENVIADO", "NUMERO_INVALIDO" o "ERROR: <detalle>"
     */
    public String enviarMensaje(String phone, String message) {
        String numero = limpiarTelefono(phone);
        if (numero == null) {
            log.warn("Teléfono inválido o vacío: {}", phone);
            return "NUMERO_INVALIDO";
        }

        try {
            String encoded = URLEncoder.encode(message, StandardCharsets.UTF_8);
            driver.get(WA_URL + "/send?phone=" + numero + "&text=" + encoded);

            WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(25));

            // Construye condición OR: input de mensaje visible O popup de error
            ExpectedConditions.or(
                    ExpectedConditions.presenceOfElementLocated(POPUP_OK)
            );

            // Espera cualquiera de los inputs posibles o el popup de error
            wait.until(d -> {
                if (!d.findElements(POPUP_OK).isEmpty()) return true;
                return MSG_INPUT_SELECTORS.stream()
                        .anyMatch(sel -> !d.findElements(sel).isEmpty());
            });

            // Número inválido → popup de error
            if (!driver.findElements(POPUP_OK).isEmpty()) {
                try { driver.findElement(POPUP_OK).click(); } catch (Exception ignored) {}
                log.info("Número inválido: {}", numero);
                return "NUMERO_INVALIDO";
            }

            // Encuentra el input de mensaje (primer selector que funcione)
            WebElement msgInput = MSG_INPUT_SELECTORS.stream()
                    .flatMap(sel -> driver.findElements(sel).stream())
                    .findFirst()
                    .orElse(null);

            if (msgInput == null) {
                return "ERROR: no se encontró el campo de mensaje";
            }

            // Clic para enfocar y Enter para enviar (el texto ya está pre-cargado por la URL)
            msgInput.click();
            Thread.sleep(300);
            msgInput.sendKeys(Keys.RETURN);
            Thread.sleep(1200);

            log.info("Mensaje enviado a {}", numero);
            return "ENVIADO";

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return "ERROR: interrumpido";
        } catch (Exception e) {
            // Chrome fue cerrado mientras se enviaba
            if (esChromeDesconectado(e)) {
                log.warn("Chrome fue cerrado durante el envío, limpiando driver");
                cerrar();
                return "ERROR_CHROME_CERRADO";
            }
            log.error("Error enviando a {}: {}", numero, e.getMessage());
            return "ERROR: " + e.getMessage();
        }
    }

    public boolean estaAbierto() {
        return driver != null;
    }

    /**
     * Verifica si Chrome sigue vivo Y WhatsApp está conectado.
     * Si el browser fue cerrado externamente, limpia el driver.
     */
    public boolean verificarEstadoReal() {
        if (driver == null) return false;
        try {
            driver.getWindowHandle(); // lanza excepción si Chrome fue cerrado
            return estaConectado();
        } catch (Exception e) {
            log.info("Chrome fue cerrado externamente, limpiando driver");
            cerrar();
            return false;
        }
    }

    private boolean esChromeDesconectado(Exception e) {
        if (e == null || e.getMessage() == null) return false;
        String msg = e.getMessage().toLowerCase();
        return msg.contains("no such window")
                || msg.contains("disconnected")
                || msg.contains("session deleted")
                || msg.contains("chrome not reachable")
                || msg.contains("target window already closed");
    }

    public void cerrar() {
        if (driver != null) {
            try { driver.quit(); } catch (Exception ignored) {}
            driver = null;
            log.info("Chrome cerrado");
        }
    }

    /**
     * Limpia y normaliza el teléfono a formato internacional colombiano (57XXXXXXXXXX).
     * Retorna null si el número no tiene dígitos suficientes.
     */
    public static String limpiarTelefono(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return null;

        // Normalizar número colombiano de 10 dígitos
        if (digits.length() == 10 && !digits.startsWith("57")) return "57" + digits;
        // Ya tiene código de país
        if (digits.startsWith("57") && digits.length() == 12) return digits;
        // Cualquier otro número con dígitos suficientes → intentar tal cual
        if (digits.length() >= 7) return digits;

        return null;
    }
}
