package com.rappi.farmer.presentation.controllers;

import com.rappi.farmer.application.dtos.DashboardDataDto;
import com.rappi.farmer.application.dtos.MessageTemplateDto;
import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.dtos.WhatsappSendProgress;
import com.rappi.farmer.application.services.DashboardService;
import com.rappi.farmer.application.services.MessageTemplateService;
import com.rappi.farmer.application.services.WhatsappService;
import javafx.application.Platform;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.concurrent.Task;
import javafx.fxml.FXML;
import javafx.scene.control.*;
import javafx.scene.control.cell.CheckBoxTableCell;
import javafx.scene.control.cell.PropertyValueFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class WhatsappController {

    private final WhatsappService whatsappService;
    private final DashboardService dashboardService;
    private final MessageTemplateService templateService;

    // ── Recomendaciones tab ──
    @FXML private ComboBox<MessageTemplateDto> cboPlantillas;
    @FXML private TextField txtNombrePlantilla;
    @FXML private TextArea txtTemplate;
    @FXML private Label lblContador;
    @FXML private Label lblEnviadosHoy;
    @FXML private Label lblEstadoWa;
    @FXML private Button btnAbrirChrome;
    @FXML private Button btnEnviar;
    @FXML private Button btnDetener;
    @FXML private Button btnCatOnboarding;
    @FXML private Button btnCatAliados;
    @FXML private Button btnCatChurn;
    @FXML private Button btnCatAva;
    @FXML private Button btnCatTodas;
    @FXML private Label lblCategoriaActual;
    @FXML private TextField txtBuscarTienda;
    @FXML private TableView<StoreViewDto> tableWa;
    @FXML private ProgressBar progressBar;
    @FXML private Label lblProgreso;
    @FXML private TextArea txtLog;

    // ── Prueba tab ──
    @FXML private TextField txtTelefonoPrueba;
    @FXML private TextArea txtMensajePrueba;
    @FXML private Button btnEnviarPrueba;
    @FXML private Label lblResultadoPrueba;

    // ── Estado interno ──
    private final Map<Long, SimpleBooleanProperty> selecciones = new HashMap<>();
    private DashboardDataDto dashboardData;
    private List<StoreViewDto> tiendaCategoria = List.of(); // tiendas de la categoría activa
    private volatile boolean enviandoActivo = false;
    private Thread hiloEnvio;

    private static final String CAT_STYLE_ACTIVE =
            "-fx-font-weight: bold; -fx-border-width: 2;";

    @FXML
    public void initialize() {
        setupTablaWa();
        cargarPlantillas();
        txtBuscarTienda.textProperty().addListener((obs, oldVal, newVal) -> aplicarFiltro(newVal));
        // Estado inicial: Chrome desconocido, deshabilitar envío hasta verificar
        btnEnviar.setDisable(true);
        btnEnviarPrueba.setDisable(true);
    }

    @FXML
    public void onLimpiarBusqueda() {
        txtBuscarTienda.clear();
    }

    /** Llamado desde MainController al abrir esta sección. */
    public void cargarTiendas() {
        Task<Object[]> task = new Task<>() {
            @Override
            protected Object[] call() {
                DashboardDataDto data = dashboardService.load();
                boolean conectado = whatsappService.verificarEstadoReal();
                long enviadosHoy = whatsappService.enviadosHoy();
                return new Object[]{data, conectado, enviadosHoy};
            }
        };
        task.setOnSucceeded(e -> {
            Object[] result = task.getValue();
            dashboardData = (DashboardDataDto) result[0];
            boolean conectado = (boolean) result[1];
            long enviadosHoy = (long) result[2];

            actualizarBadgesCategorias();
            if (!conTelefono(dashboardData.getOnboardingCritical()).isEmpty()) {
                onFiltrarOnboarding();
            } else {
                onFiltrarTodas();
            }
            lblEnviadosHoy.setText(String.valueOf(enviadosHoy));
            sincronizarEstadoChrome(conectado);
        });
        Thread t = new Thread(task);
        t.setDaemon(true);
        t.start();
    }

    /**
     * Ajusta los botones según si Chrome/WhatsApp siguen vivos.
     * Se llama cada vez que el usuario abre esta sección.
     */
    private void sincronizarEstadoChrome(boolean conectado) {
        if (conectado) {
            setEstadoWa("● Conectado", "#27ae60");
            btnAbrirChrome.setText("✓ WhatsApp Conectado");
            btnAbrirChrome.setDisable(true);
            btnEnviar.setDisable(false);
            btnEnviarPrueba.setDisable(false);
        } else {
            // Chrome cerrado o sesión caída — resetea la UI
            setEstadoWa("● No conectado", "#e74c3c");
            btnAbrirChrome.setText("Abrir WhatsApp Web");
            btnAbrirChrome.setDisable(false);
            btnEnviar.setDisable(true);
            btnEnviarPrueba.setDisable(true);
        }
    }

    // ── Filtros de categoría ──────────────────────────────────────────────────

    @FXML public void onFiltrarOnboarding() {
        if (dashboardData == null) return;
        List<StoreViewDto> tiendas = conTelefono(dashboardData.getOnboardingCritical());
        mostrarCategoria(tiendas, "Onboarding sin venta (días 1-8) — " + tiendas.size() + " tiendas con teléfono");
        resaltarBoton(btnCatOnboarding);
        sugerirPlantilla("Onboarding sin venta");
    }

    @FXML public void onFiltrarAliados() {
        if (dashboardData == null) return;
        List<StoreViewDto> tiendas = conTelefono(dashboardData.getAliados());
        mostrarCategoria(tiendas, "Aliados con AVA < 60% (días 8-14) — " + tiendas.size() + " tiendas");
        resaltarBoton(btnCatAliados);
        sugerirPlantilla("Aliados baja conexión");
    }

    @FXML public void onFiltrarChurn() {
        if (dashboardData == null) return;
        List<StoreViewDto> tiendas = conTelefono(dashboardData.getChurnRisk());
        mostrarCategoria(tiendas, "Riesgo Churn (M1/M2) — " + tiendas.size() + " tiendas");
        resaltarBoton(btnCatChurn);
        sugerirPlantilla("Riesgo Churn");
    }

    @FXML public void onFiltrarAva() {
        if (dashboardData == null) return;
        List<StoreViewDto> tiendas = conTelefono(dashboardData.getAvaDropping());
        mostrarCategoria(tiendas, "AVA bajando (>14 días, conexión <60%) — " + tiendas.size() + " tiendas");
        resaltarBoton(btnCatAva);
        sugerirPlantilla("Aliados baja conexión");
    }

    @FXML public void onFiltrarTodas() {
        if (dashboardData == null) return;
        List<StoreViewDto> tiendas = conTelefono(dashboardData.allStores());
        mostrarCategoria(tiendas, "Todas las tiendas activas — " + tiendas.size() + " con teléfono");
        resaltarBoton(btnCatTodas);
    }

    // ── Gestión de plantillas ─────────────────────────────────────────────────

    @FXML
    public void onNuevaPlantilla() {
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle("Nueva plantilla");
        dialog.setHeaderText("¿Cómo se llama la nueva plantilla?");
        dialog.setContentText("Nombre:");
        Optional<String> resultado = dialog.showAndWait();
        resultado.filter(n -> !n.isBlank()).ifPresent(nombre -> {
            MessageTemplateDto dto = templateService.save(nombre, "Hola {store_name}! 👋 ");
            cargarPlantillas();
            cboPlantillas.getItems().stream()
                    .filter(t -> t.getId().equals(dto.getId()))
                    .findFirst()
                    .ifPresent(t -> cboPlantillas.getSelectionModel().select(t));
        });
    }

    @FXML
    public void onGuardarPlantilla() {
        MessageTemplateDto seleccionada = cboPlantillas.getValue();
        String nombre = txtNombrePlantilla.getText().trim();
        String contenido = txtTemplate.getText().trim();

        if (nombre.isEmpty() || contenido.isEmpty()) {
            mostrarAlerta("El nombre y el contenido no pueden estar vacíos.");
            return;
        }

        if (seleccionada != null) {
            templateService.update(seleccionada.getId(), nombre, contenido);
        } else {
            templateService.save(nombre, contenido);
        }

        cargarPlantillas();
        mostrarAlertaInfo("Plantilla guardada correctamente.");
    }

    @FXML
    public void onEliminarPlantilla() {
        MessageTemplateDto seleccionada = cboPlantillas.getValue();
        if (seleccionada == null) return;

        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "¿Eliminar la plantilla \"" + seleccionada.getName() + "\"?",
                ButtonType.YES, ButtonType.NO);
        confirm.setTitle("Confirmar eliminación");
        confirm.setHeaderText(null);
        confirm.showAndWait().filter(b -> b == ButtonType.YES).ifPresent(b -> {
            templateService.delete(seleccionada.getId());
            cargarPlantillas();
        });
    }

    // ── Chrome y envío ────────────────────────────────────────────────────────

    @FXML
    public void onAbrirChrome() {
        btnAbrirChrome.setDisable(true);
        setEstadoWa("Abriendo Chrome...", "#e67e22");

        Task<Boolean> task = new Task<>() {
            @Override
            protected Boolean call() {
                whatsappService.abrirChrome();
                return whatsappService.esperarConexion(60);
            }
        };
        task.setOnSucceeded(e -> {
            if (task.getValue()) {
                setEstadoWa("● Conectado", "#27ae60");
                btnEnviar.setDisable(false);
                btnEnviarPrueba.setDisable(false);
                btnAbrirChrome.setText("✓ WhatsApp Conectado");
            } else {
                setEstadoWa("● Escanea el QR en Chrome y vuelve a intentar", "#e74c3c");
                btnAbrirChrome.setDisable(false);
            }
        });
        task.setOnFailed(e -> {
            setEstadoWa("● Error al abrir Chrome", "#e74c3c");
            btnAbrirChrome.setDisable(false);
            log.error("Error abriendo Chrome", task.getException());
        });

        Thread t = new Thread(task);
        t.setDaemon(true);
        t.start();
    }

    @FXML
    public void onIniciarEnvio() {
        String template = txtTemplate.getText().trim();
        if (template.isEmpty()) {
            mostrarAlerta("Escribe o selecciona un mensaje antes de enviar.");
            return;
        }
        List<StoreViewDto> seleccionadas = tiendas().stream()
                .filter(s -> {
                    SimpleBooleanProperty p = selecciones.get(s.getId());
                    return p != null && p.get();
                })
                .limit(40)
                .collect(Collectors.toList());

        if (seleccionadas.isEmpty()) {
            mostrarAlerta("Selecciona al menos una tienda.");
            return;
        }

        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "Se enviarán mensajes a " + seleccionadas.size() + " tiendas.\n¿Continuar?",
                ButtonType.YES, ButtonType.NO);
        confirm.setTitle("Confirmar envío masivo");
        confirm.setHeaderText(null);
        confirm.showAndWait().filter(b -> b == ButtonType.YES)
                .ifPresent(b -> iniciarEnvio(seleccionadas, template));
    }

    @FXML
    public void onDetener() {
        enviandoActivo = false;
        if (hiloEnvio != null) hiloEnvio.interrupt();
        btnDetener.setVisible(false);
        btnDetener.setManaged(false);
        btnEnviar.setDisable(false);
        setEstadoWa("● Envío detenido", "#e67e22");
    }

    @FXML public void onMarcarTodas() {
        long disponibles = 40 - whatsappService.enviadosHoy();
        int marcadas = 0;
        for (StoreViewDto s : tiendas()) {
            boolean marcar = marcadas < disponibles;
            SimpleBooleanProperty p = selecciones.computeIfAbsent(s.getId(), k -> new SimpleBooleanProperty(false));
            p.set(marcar);
            if (marcar) marcadas++;
        }
        tableWa.refresh();
        actualizarContador();
    }

    @FXML public void onDesmarcarTodas() {
        selecciones.values().forEach(p -> p.set(false));
        tableWa.refresh();
        actualizarContador();
    }

    // ── Prueba ────────────────────────────────────────────────────────────────

    @FXML
    public void onUsarPlantillaEnPrueba() {
        txtMensajePrueba.setText(txtTemplate.getText());
    }

    @FXML
    public void onEnviarPrueba() {
        String telefono = txtTelefonoPrueba.getText().trim();
        String mensaje = txtMensajePrueba.getText().trim();

        if (telefono.isEmpty() || mensaje.isEmpty()) {
            lblResultadoPrueba.setText("Completa el número y el mensaje.");
            lblResultadoPrueba.setStyle("-fx-text-fill: #e74c3c;");
            return;
        }

        btnEnviarPrueba.setDisable(true);
        lblResultadoPrueba.setText("Enviando...");
        lblResultadoPrueba.setStyle("-fx-text-fill: #e67e22;");

        Task<String> task = new Task<>() {
            @Override
            protected String call() {
                return whatsappService.enviarPrueba(telefono, mensaje);
            }
        };
        task.setOnSucceeded(e -> {
            String resultado = task.getValue();
            boolean ok = "ENVIADO".equals(resultado);
            lblResultadoPrueba.setText(ok ? "✓ Mensaje enviado correctamente" : "✗ " + resultado);
            lblResultadoPrueba.setStyle("-fx-text-fill: " + (ok ? "#27ae60" : "#e74c3c") + "; -fx-font-size: 13px;");
            btnEnviarPrueba.setDisable(false);
        });
        task.setOnFailed(e -> {
            lblResultadoPrueba.setText("✗ Error: " + task.getException().getMessage());
            lblResultadoPrueba.setStyle("-fx-text-fill: #e74c3c;");
            btnEnviarPrueba.setDisable(false);
        });

        Thread t = new Thread(task);
        t.setDaemon(true);
        t.start();
    }

    // ── Envío masivo en background ────────────────────────────────────────────

    private void iniciarEnvio(List<StoreViewDto> stores, String template) {
        enviandoActivo = true;
        btnEnviar.setDisable(true);
        btnDetener.setVisible(true);
        btnDetener.setManaged(true);
        mostrarProgreso(true);
        txtLog.clear();
        progressBar.setProgress(0);

        hiloEnvio = new Thread(() -> {
            whatsappService.enviarMasivo(stores, template, progress -> {
                if (!enviandoActivo && !progress.isFinalizado()) return;
                Platform.runLater(() -> actualizarUI(progress));
            });
        });
        hiloEnvio.setDaemon(true);
        hiloEnvio.start();
    }

    private void actualizarUI(WhatsappSendProgress p) {
        if (p.isFinalizado()) {
            progressBar.setProgress(1.0);
            lblProgreso.setText("Completado — " + p.getEnviados() + " enviados, " + p.getErrores() + " errores");
            btnDetener.setVisible(false);
            btnDetener.setManaged(false);
            btnEnviar.setDisable(false);
            enviandoActivo = false;
            lblEnviadosHoy.setText(String.valueOf(whatsappService.enviadosHoy()));
            appendLog("── Finalizado: " + p.getEnviados() + " enviados, " + p.getErrores() + " errores ──");
            return;
        }
        progressBar.setProgress((double) p.getProcesados() / p.getTotal());
        lblProgreso.setText(p.getProcesados() + "/" + p.getTotal()
                + "  ✓ " + p.getEnviados() + "  ✗ " + p.getErrores());

        if (!"ENVIANDO".equals(p.getStatus())) {
            String icono = "ENVIADO".equals(p.getStatus()) ? "✓" :
                           "NUMERO_INVALIDO".equals(p.getStatus()) ? "✗ inválido" : "✗ error";
            appendLog(icono + "  " + p.getStoreName());
        }
    }

    // ── Setup tabla ───────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void setupTablaWa() {
        tableWa.setEditable(true);

        TableColumn<StoreViewDto, Boolean> checkCol = new TableColumn<>("");
        checkCol.setPrefWidth(36);
        checkCol.setEditable(true);
        checkCol.setCellValueFactory(data -> {
            Long id = data.getValue().getId();
            SimpleBooleanProperty prop = selecciones.computeIfAbsent(id, k -> new SimpleBooleanProperty(false));
            prop.addListener((obs, oldVal, newVal) -> Platform.runLater(this::actualizarContador));
            return prop;
        });
        checkCol.setCellFactory(CheckBoxTableCell.forTableColumn(checkCol));

        TableColumn<StoreViewDto, String> nameCol = new TableColumn<>("Tienda");
        nameCol.setCellValueFactory(new PropertyValueFactory<>("storeName"));
        nameCol.setPrefWidth(220);

        TableColumn<StoreViewDto, String> phoneCol = new TableColumn<>("Teléfono");
        phoneCol.setCellValueFactory(new PropertyValueFactory<>("phoneNumber"));
        phoneCol.setPrefWidth(120);

        TableColumn<StoreViewDto, Integer> agingCol = new TableColumn<>("Días");
        agingCol.setCellValueFactory(new PropertyValueFactory<>("aging"));
        agingCol.setPrefWidth(50);

        TableColumn<StoreViewDto, Object> avaCol = new TableColumn<>("Conexión %");
        avaCol.setCellValueFactory(new PropertyValueFactory<>("connectionPercentage"));
        avaCol.setPrefWidth(90);
        avaCol.setCellFactory(col -> new TableCell<>() {
            @Override
            protected void updateItem(Object item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) { setText("—"); return; }
                setText(String.format("%.1f%%", ((java.math.BigDecimal) item).doubleValue()));
            }
        });

        TableColumn<StoreViewDto, String> gestionCol = new TableColumn<>("Gestión hoy");
        gestionCol.setCellValueFactory(new PropertyValueFactory<>("todayManagementResult"));
        gestionCol.setPrefWidth(100);
        gestionCol.setCellFactory(col -> new TableCell<>() {
            @Override
            protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty) { setText(null); setStyle(""); return; }
                if (item == null) { setText("—"); setStyle("-fx-text-fill: #bbb;"); return; }
                setText(item);
                setStyle("EXITOSA".equals(item)
                        ? "-fx-text-fill: #2e7d32; -fx-font-weight: bold;"
                        : "-fx-text-fill: #757575;");
            }
        });

        tableWa.getColumns().addAll(checkCol, nameCol, phoneCol, agingCol, avaCol, gestionCol);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void cargarPlantillas() {
        List<MessageTemplateDto> plantillas = templateService.getAll();
        cboPlantillas.setItems(FXCollections.observableArrayList(plantillas));
        if (!plantillas.isEmpty()) {
            cboPlantillas.getSelectionModel().selectFirst();
            onPlantillaSeleccionada();
        }
        cboPlantillas.setOnAction(e -> onPlantillaSeleccionada());
    }

    private void onPlantillaSeleccionada() {
        MessageTemplateDto t = cboPlantillas.getValue();
        if (t == null) return;
        txtNombrePlantilla.setText(t.getName());
        txtTemplate.setText(t.getContent());
    }

    private void sugerirPlantilla(String nombre) {
        cboPlantillas.getItems().stream()
                .filter(t -> t.getName().equalsIgnoreCase(nombre))
                .findFirst()
                .ifPresent(t -> {
                    cboPlantillas.getSelectionModel().select(t);
                    onPlantillaSeleccionada();
                });
    }

    private void mostrarCategoria(List<StoreViewDto> tiendas, String descripcion) {
        ensureSelecciones(tiendas);
        tiendaCategoria = tiendas;
        txtBuscarTienda.clear();
        tableWa.setItems(FXCollections.observableArrayList(tiendas));
        lblCategoriaActual.setText(descripcion);
        actualizarContador();
    }

    private void aplicarFiltro(String texto) {
        if (texto == null || texto.isBlank()) {
            tableWa.setItems(FXCollections.observableArrayList(tiendaCategoria));
            return;
        }
        String q = texto.trim().toLowerCase();
        List<StoreViewDto> filtradas = tiendaCategoria.stream()
                .filter(s -> (s.getStoreName() != null && s.getStoreName().toLowerCase().contains(q))
                        || (s.getStoreCode() != null && s.getStoreCode().toLowerCase().contains(q)))
                .collect(Collectors.toList());
        tableWa.setItems(FXCollections.observableArrayList(filtradas));
    }

    private void ensureSelecciones(List<StoreViewDto> tiendas) {
        tiendas.forEach(s -> selecciones.computeIfAbsent(s.getId(),
                k -> new SimpleBooleanProperty(false)));
    }

    private void actualizarBadgesCategorias() {
        btnCatOnboarding.setText("Onboarding (" + conTelefono(dashboardData.getOnboardingCritical()).size() + ")");
        btnCatAliados.setText("Aliados <60% (" + conTelefono(dashboardData.getAliados()).size() + ")");
        btnCatChurn.setText("Churn (" + conTelefono(dashboardData.getChurnRisk()).size() + ")");
        btnCatAva.setText("AVA bajando (" + conTelefono(dashboardData.getAvaDropping()).size() + ")");
    }

    private void actualizarContador() {
        long count = selecciones.values().stream().filter(SimpleBooleanProperty::get).count();
        lblContador.setText(count + "/40");
        lblContador.setStyle("-fx-font-size: 20px; -fx-font-weight: bold; -fx-text-fill: "
                + (count >= 40 ? "#e74c3c" : count > 0 ? "#27ae60" : "#e31837") + ";");
    }

    private void resaltarBoton(Button activo) {
        for (Button b : List.of(btnCatOnboarding, btnCatAliados, btnCatChurn, btnCatAva, btnCatTodas)) {
            b.setStyle(b.getStyle().replace("-fx-font-weight: bold;", ""));
        }
        if (!activo.getStyle().contains("-fx-font-weight: bold;")) {
            activo.setStyle(activo.getStyle() + "-fx-font-weight: bold;");
        }
    }

    private List<StoreViewDto> conTelefono(List<StoreViewDto> stores) {
        return stores.stream()
                .filter(s -> s.getPhoneNumber() != null && !s.getPhoneNumber().isBlank())
                .collect(Collectors.toList());
    }

    private void setEstadoWa(String texto, String color) {
        lblEstadoWa.setText(texto);
        lblEstadoWa.setStyle("-fx-font-size: 12px; -fx-text-fill: " + color + ";");
    }

    private void mostrarProgreso(boolean visible) {
        progressBar.setVisible(visible);
        progressBar.setManaged(visible);
        lblProgreso.setVisible(visible);
        lblProgreso.setManaged(visible);
        txtLog.setVisible(visible);
        txtLog.setManaged(visible);
    }

    private void appendLog(String linea) {
        txtLog.appendText(linea + "\n");
    }

    private ObservableList<StoreViewDto> tiendas() {
        return tableWa.getItems() == null
                ? FXCollections.emptyObservableList()
                : tableWa.getItems();
    }

    private void mostrarAlerta(String msg) {
        new Alert(Alert.AlertType.WARNING, msg, ButtonType.OK).showAndWait();
    }

    private void mostrarAlertaInfo(String msg) {
        new Alert(Alert.AlertType.INFORMATION, msg, ButtonType.OK).showAndWait();
    }
}
