package com.rappi.farmer.presentation.controllers;

import com.rappi.farmer.application.dtos.DashboardDataDto;
import com.rappi.farmer.application.dtos.ImportResultDto;
import com.rappi.farmer.application.dtos.ManagementViewDto;
import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.services.DashboardService;
import com.rappi.farmer.application.services.ManagementService;
import com.rappi.farmer.application.services.StoreDetailService;
import com.rappi.farmer.application.services.StoreImportService;
import com.rappi.farmer.domain.entities.Store;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.concurrent.Task;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.scene.input.Clipboard;
import javafx.scene.layout.VBox;
import javafx.scene.input.ClipboardContent;
import javafx.scene.input.KeyCode;
import javafx.stage.FileChooser;
import javafx.stage.Modality;
import javafx.stage.Stage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.io.File;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class MainController {

    private final StoreImportService storeImportService;
    private final DashboardService dashboardService;
    private final ManagementService managementService;
    private final StoreDetailService storeDetailService;
    private final ApplicationContext applicationContext;

    // ── Barra superior ──
    @FXML private Button btnCargarExcel;
    @FXML private ProgressIndicator progressIndicator;
    @FXML private Label lblEstado;

    // ── Sidebar ──
    @FXML private TextField txtBuscarStore;
    @FXML private VBox groupCartera;
    @FXML private VBox groupActividad;
    @FXML private Label arrowCartera;
    @FXML private Label arrowActividad;

    @FXML private Button btnOnboarding;
    @FXML private Button btnAliados;
    @FXML private Button btnChurn;
    @FXML private Button btnAva;
    @FXML private Button btnHealthy;
    @FXML private Button btnAvaLow;
    @FXML private Button btnGestiones;
    @FXML private Button btnWhatsapp;

    // ── Contenido central ──
    @FXML private Label lblSectionTitle;
    @FXML private TableView<StoreViewDto> tableStores;
    @FXML private TableView<ManagementViewDto> tableGestiones;
    @FXML private Node whatsappPanel;
    @FXML private WhatsappController whatsappPanelController;

    // ── Estado ──
    private DashboardDataDto dashboardData;
    private Button selectedButton;
    private Section currentSection = null;
    private boolean modoGestiones = false;
    private boolean modoWhatsapp = false;

    private enum Section { ONBOARDING, ALIADOS, CHURN, AVA, HEALTHY, AVA_LOW }

    // ── Estilos botones ──
    private static final String BTN_NORMAL =
            "-fx-background-color: transparent; -fx-text-fill: #ecf0f1; " +
            "-fx-font-size: 13px; -fx-alignment: CENTER-LEFT; -fx-padding: 9 16; -fx-cursor: hand;";
    private static final String BTN_SELECTED =
            "-fx-background-color: #e31837; -fx-text-fill: white; " +
            "-fx-font-size: 13px; -fx-font-weight: bold; -fx-alignment: CENTER-LEFT; " +
            "-fx-padding: 9 16; -fx-cursor: hand;";
    private static final String BTN_GESTIONES_NORMAL =
            "-fx-background-color: transparent; -fx-text-fill: #2ecc71; " +
            "-fx-font-size: 13px; -fx-font-weight: bold; -fx-alignment: CENTER-LEFT; " +
            "-fx-padding: 9 16; -fx-cursor: hand;";
    private static final String BTN_WA_NORMAL =
            "-fx-background-color: transparent; -fx-text-fill: #25d366; " +
            "-fx-font-size: 13px; -fx-font-weight: bold; -fx-alignment: CENTER-LEFT; " +
            "-fx-padding: 9 16; -fx-cursor: hand;";
    private static final String BTN_AVA_LOW_NORMAL =
            "-fx-background-color: transparent; -fx-text-fill: #e74c3c; " +
            "-fx-font-size: 13px; -fx-font-weight: bold; -fx-alignment: CENTER-LEFT; " +
            "-fx-padding: 9 16; -fx-cursor: hand;";

    @FXML
    public void initialize() {
        setupStoreTableColumns();
        setupGestionesTableColumns();
        cargarDashboard();
    }

    // ── Cargar Excel ──────────────────────────────────────────────────────────

    @FXML
    public void onCargarExcel() {
        FileChooser fc = new FileChooser();
        fc.setTitle("Seleccionar archivo Excel de cartera");
        fc.getExtensionFilters().add(
                new FileChooser.ExtensionFilter("Archivos Excel", "*.xlsx", "*.xls"));
        File file = fc.showOpenDialog(btnCargarExcel.getScene().getWindow());
        if (file == null) return;

        Task<ImportResultDto> task = new Task<>() {
            @Override protected ImportResultDto call() throws Exception {
                return storeImportService.importFromExcel(file);
            }
        };
        task.setOnRunning(e -> mostrarProgreso("Importando " + file.getName() + "..."));
        task.setOnSucceeded(e -> {
            ocultarProgreso();
            ImportResultDto r = task.getValue();
            mostrarEstado(String.format("Importado: %d creadas, %d actualizadas", r.getCreated(), r.getUpdated()));
            cargarDashboard();
        });
        task.setOnFailed(e -> {
            ocultarProgreso();
            mostrarError("Error al importar: " + task.getException().getMessage());
        });
        Thread t = new Thread(task); t.setDaemon(true); t.start();
    }

    // ── Secciones ─────────────────────────────────────────────────────────────

    @FXML public void onSectionOnboarding() {
        currentSection = Section.ONBOARDING;
        mostrarSeccionTiendas(btnOnboarding,
                "Onboarding critico (dias 1-8 sin primera orden)",
                dashboardData == null ? List.of() : dashboardData.getOnboardingCritical());
    }
    @FXML public void onSectionAliados() {
        currentSection = Section.ALIADOS;
        mostrarSeccionTiendas(btnAliados,
                "Conexion Rappi Aliados (dias 8-14, AVA < 60%)",
                dashboardData == null ? List.of() : dashboardData.getAliados());
    }
    @FXML public void onSectionChurn() {
        currentSection = Section.CHURN;
        mostrarSeccionTiendas(btnChurn,
                "Riesgo Churn (M1 / M2)",
                dashboardData == null ? List.of() : dashboardData.getChurnRisk());
    }
    @FXML public void onSectionAva() {
        currentSection = Section.AVA;
        mostrarSeccionTiendas(btnAva,
                "AVA bajando (conexion < 60%)",
                dashboardData == null ? List.of() : dashboardData.getAvaDropping());
    }
    @FXML public void onSectionHealthy() {
        currentSection = Section.HEALTHY;
        mostrarSeccionTiendas(btnHealthy,
                "Saludables",
                dashboardData == null ? List.of() : dashboardData.getHealthy());
    }
    @FXML public void onSectionAvaLow() {
        currentSection = Section.AVA_LOW;
        mostrarSeccionTiendas(btnAvaLow,
                "AVA entre 1% y 15% — todas las tiendas",
                dashboardData == null ? List.of() : dashboardData.getAvaLow());
    }

    @FXML
    public void onSectionGestiones() {
        modoGestiones = true;
        modoWhatsapp = false;
        currentSection = null;
        ocultarTodosLosPaneles();
        if (selectedButton != null) selectedButton.setStyle(normalStyleFor(selectedButton));
        selectedButton = null;
        btnWhatsapp.setStyle(BTN_WA_NORMAL);
        btnGestiones.setStyle(BTN_SELECTED.replace("#e31837", "#27ae60"));

        tableGestiones.setVisible(true);
        tableGestiones.setManaged(true);

        List<ManagementViewDto> gestiones = managementService.getTodayManagements();
        lblSectionTitle.setText("Gestiones del dia — " + gestiones.size() + " registradas");
        tableGestiones.setItems(FXCollections.observableArrayList(gestiones));
        btnGestiones.setText("Gestiones del dia (" + gestiones.size() + ")");
    }

    @FXML
    public void onSectionWhatsapp() {
        modoWhatsapp = true;
        modoGestiones = false;
        currentSection = null;
        ocultarTodosLosPaneles();
        if (selectedButton != null) selectedButton.setStyle(normalStyleFor(selectedButton));
        selectedButton = null;
        btnGestiones.setStyle(BTN_GESTIONES_NORMAL);
        btnWhatsapp.setStyle(BTN_SELECTED.replace("#e31837", "#128c4f"));

        whatsappPanel.setVisible(true);
        whatsappPanel.setManaged(true);
        lblSectionTitle.setText("WhatsApp Masivo");
        whatsappPanelController.cargarTiendas();
    }

    // ── Sidebar colapsable ────────────────────────────────────────────────────

    @FXML
    public void onToggleCartera() {
        toggle(groupCartera, arrowCartera);
    }

    @FXML
    public void onToggleActividad() {
        toggle(groupActividad, arrowActividad);
    }

    private void toggle(VBox group, Label arrow) {
        boolean visible = !group.isVisible();
        group.setVisible(visible);
        group.setManaged(visible);
        arrow.setText(visible ? "▼" : "►");
    }

    // ── Búsqueda de tienda ────────────────────────────────────────────────────

    @FXML
    public void onBuscarTienda() {
        String query = txtBuscarStore.getText().trim();
        if (query.isEmpty()) return;

        List<StoreViewDto> resultados = storeDetailService.searchStores(query);

        if (resultados.isEmpty()) {
            mostrarDialogoSinResultado(query);
            return;
        }

        StoreViewDto store = resultados.stream()
                .filter(s -> s.getStoreCode().equalsIgnoreCase(query))
                .findFirst()
                .orElse(resultados.get(0));

        mostrarDialogoTienda(store);
    }

    private void mostrarDialogoTienda(StoreViewDto store) {
        String categoria = categoriaDe(store);
        String infoGestion = storeDetailService.getLastManagementSummary(store.getId());
        String analisisConexion = storeDetailService.getConnectionAnalysis(store.getId());

        String info = String.format(
                "Tienda:          %s%n" +
                "Código:          %s%n" +
                "Teléfono:        %s%n" +
                "Días activa:     %d%n" +
                "Categoría:       %s%n" +
                "Última gestión:  %s%n" +
                "%n" +
                "── Análisis de conexión ──%n" +
                "%s",
                store.getStoreName(),
                store.getStoreCode(),
                store.getPhoneNumber() != null ? store.getPhoneNumber() : "—",
                store.getAging(),
                categoria,
                infoGestion,
                analisisConexion
        );

        Alert alert = new Alert(Alert.AlertType.INFORMATION);
        alert.setTitle("Información de tienda");
        alert.setHeaderText(store.getStoreName() + "  —  " + store.getStoreCode());
        alert.setContentText(info);

        ButtonType btnGestionar = new ButtonType("Registrar Gestión");
        ButtonType btnCerrar    = new ButtonType("Cerrar", ButtonBar.ButtonData.CANCEL_CLOSE);
        alert.getButtonTypes().setAll(btnGestionar, btnCerrar);

        alert.showAndWait().filter(b -> b == btnGestionar).ifPresent(b -> {
            StoreViewDto dto = encontrarStoreViewDto(store.getId());
            if (dto != null) abrirDialogoGestion(dto);
            else abrirDialogoGestion(store);
        });
    }

    private void mostrarDialogoSinResultado(String query) {
        Alert alert = new Alert(Alert.AlertType.WARNING);
        alert.setTitle("Sin resultados");
        alert.setHeaderText(null);
        alert.setContentText("No se encontró ninguna tienda con código o nombre: \"" + query + "\"");
        alert.showAndWait();
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    private void cargarDashboard() {
        Task<DashboardDataDto> task = new Task<>() {
            @Override protected DashboardDataDto call() { return dashboardService.load(); }
        };
        task.setOnSucceeded(e -> {
            dashboardData = task.getValue();
            actualizarBadges();
            if (!modoGestiones && !modoWhatsapp) {
                refrescarSeccionActual();
            }
        });
        Thread t = new Thread(task); t.setDaemon(true); t.start();
    }

    /** Vuelve a la misma sección que estaba abierta después de recargar datos. */
    private void refrescarSeccionActual() {
        if (currentSection != null) {
            switch (currentSection) {
                case ONBOARDING -> onSectionOnboarding();
                case ALIADOS    -> onSectionAliados();
                case CHURN      -> onSectionChurn();
                case AVA        -> onSectionAva();
                case HEALTHY    -> onSectionHealthy();
                case AVA_LOW    -> onSectionAvaLow();
            }
        } else {
            // Primera carga: ir a la primera sección con datos
            if (dashboardData.getOnboardingCount() > 0)       onSectionOnboarding();
            else if (dashboardData.getAliadosCount() > 0)     onSectionAliados();
            else if (dashboardData.getChurnCount() > 0)       onSectionChurn();
            else if (dashboardData.getAvaDroppingCount() > 0) onSectionAva();
            else                                               onSectionHealthy();
        }
    }

    private void actualizarBadges() {
        btnOnboarding.setText("Onboarding 1-8 (" + dashboardData.getOnboardingCount() + ")");
        btnAliados.setText("Conexion Aliados (" + dashboardData.getAliadosCount() + ")");
        btnChurn.setText("Riesgo Churn (" + dashboardData.getChurnCount() + ")");
        btnAva.setText("AVA bajando (" + dashboardData.getAvaDroppingCount() + ")");
        btnHealthy.setText("Saludables (" + dashboardData.getHealthyCount() + ")");
        btnAvaLow.setText("AVA 1%-15% (" + dashboardData.getAvaLowCount() + ")");
    }

    // ── Lógica de paneles ─────────────────────────────────────────────────────

    private void mostrarSeccionTiendas(Button button, String titulo, List<StoreViewDto> stores) {
        modoGestiones = false;
        modoWhatsapp = false;
        ocultarTodosLosPaneles();
        tableStores.setVisible(true);
        tableStores.setManaged(true);

        if (selectedButton != null) selectedButton.setStyle(normalStyleFor(selectedButton));
        btnGestiones.setStyle(BTN_GESTIONES_NORMAL);
        btnWhatsapp.setStyle(BTN_WA_NORMAL);

        selectedButton = button;
        button.setStyle(BTN_SELECTED);
        lblSectionTitle.setText(titulo + " — " + stores.size() + " tiendas");
        tableStores.setItems(FXCollections.observableArrayList(stores));
    }

    private void ocultarTodosLosPaneles() {
        tableStores.setVisible(false);    tableStores.setManaged(false);
        tableGestiones.setVisible(false); tableGestiones.setManaged(false);
        whatsappPanel.setVisible(false);  whatsappPanel.setManaged(false);
    }

    /** Devuelve el estilo normal correcto para un botón del sidebar. */
    private String normalStyleFor(Button btn) {
        if (btn == btnAvaLow)   return BTN_AVA_LOW_NORMAL;
        if (btn == btnGestiones) return BTN_GESTIONES_NORMAL;
        if (btn == btnWhatsapp)  return BTN_WA_NORMAL;
        return BTN_NORMAL;
    }

    // ── Diálogos de gestión ───────────────────────────────────────────────────

    private void abrirDialogoEdicion(ManagementViewDto dto) {
        try {
            FXMLLoader loader = new FXMLLoader(getClass().getResource("/fxml/gestion-dialog.fxml"));
            loader.setControllerFactory(applicationContext::getBean);
            Parent root = loader.load();
            GestionDialogController ctrl = loader.getController();
            ctrl.setExistingManagement(dto);
            ctrl.setOnSaved(() -> Platform.runLater(() -> { cargarDashboard(); onSectionGestiones(); }));
            abrirStage("Editar Gestión", root, tableGestiones);
        } catch (Exception e) {
            log.error("Error abriendo diálogo de edición", e);
        }
    }

    private void abrirDialogoGestion(StoreViewDto store) {
        try {
            FXMLLoader loader = new FXMLLoader(getClass().getResource("/fxml/gestion-dialog.fxml"));
            loader.setControllerFactory(applicationContext::getBean);
            Parent root = loader.load();
            GestionDialogController ctrl = loader.getController();
            ctrl.setStore(store);
            ctrl.setOnSaved(() -> Platform.runLater(() -> {
                cargarDashboard();
                if (modoGestiones) onSectionGestiones();
            }));
            abrirStage("Registrar Gestión", root, tableStores);
        } catch (Exception e) {
            log.error("Error abriendo diálogo de gestión", e);
        }
    }

    private void abrirStage(String titulo, Parent root, Node owner) {
        Stage dialog = new Stage();
        dialog.initModality(Modality.WINDOW_MODAL);
        dialog.initOwner(owner.getScene().getWindow());
        dialog.setTitle(titulo);
        dialog.setResizable(false);
        dialog.setScene(new Scene(root));
        dialog.show();
    }

    // ── Columnas tabla tiendas ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void setupStoreTableColumns() {
        TableColumn<StoreViewDto, String> nameCol = new TableColumn<>("Tienda");
        nameCol.setCellValueFactory(new PropertyValueFactory<>("storeName"));
        nameCol.setPrefWidth(200);
        nameCol.setCellFactory(col -> copiableCell());

        TableColumn<StoreViewDto, String> codeCol = new TableColumn<>("Código");
        codeCol.setCellValueFactory(new PropertyValueFactory<>("storeCode"));
        codeCol.setPrefWidth(90);
        codeCol.setCellFactory(col -> copiableCell());

        TableColumn<StoreViewDto, String> phoneCol = new TableColumn<>("Teléfono");
        phoneCol.setCellValueFactory(new PropertyValueFactory<>("phoneNumber"));
        phoneCol.setPrefWidth(115);
        phoneCol.setCellFactory(col -> copiableCell());

        TableColumn<StoreViewDto, Integer> agingCol = new TableColumn<>("Días");
        agingCol.setCellValueFactory(new PropertyValueFactory<>("aging"));
        agingCol.setPrefWidth(55);

        TableColumn<StoreViewDto, Integer> ordersCol = new TableColumn<>("Órdenes L4W");
        ordersCol.setCellValueFactory(new PropertyValueFactory<>("ordersL4W"));
        ordersCol.setPrefWidth(95);

        TableColumn<StoreViewDto, Object> connectionCol = new TableColumn<>("Conexión %");
        connectionCol.setCellValueFactory(new PropertyValueFactory<>("connectionPercentage"));
        connectionCol.setPrefWidth(95);
        connectionCol.setCellFactory(col -> new TableCell<>() {
            @Override protected void updateItem(Object item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) { setText(null); return; }
                String val = String.format("%.2f%%", ((java.math.BigDecimal) item).doubleValue());
                setText(val);
                agregarContextMenu(this, val);
            }
        });

        TableColumn<StoreViewDto, String> statusCol = new TableColumn<>("Estado Churn");
        statusCol.setCellValueFactory(new PropertyValueFactory<>("currentStatus"));
        statusCol.setPrefWidth(110);

        TableColumn<StoreViewDto, String> tendenciaCol = new TableColumn<>("Tendencia AVA");
        tendenciaCol.setCellValueFactory(new PropertyValueFactory<>("tendencia"));
        tendenciaCol.setPrefWidth(105);
        tendenciaCol.setCellFactory(col -> new TableCell<>() {
            @Override protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) { setText(null); setStyle(""); return; }
                setText(item);
                setStyle(switch (item) {
                    case "Subiendo" -> "-fx-text-fill: #2e7d32; -fx-font-weight: bold;";
                    case "Bajando"  -> "-fx-text-fill: #c62828; -fx-font-weight: bold;";
                    case "Estable"  -> "-fx-text-fill: #1565c0;";
                    default         -> "-fx-text-fill: #999;";
                });
            }
        });

        TableColumn<StoreViewDto, Void> gestionCol = new TableColumn<>("Gestionar");
        gestionCol.setPrefWidth(105);
        gestionCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button();
            { btn.setOnAction(e -> abrirDialogoGestion(getTableView().getItems().get(getIndex()))); }

            @Override protected void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                if (empty) { setGraphic(null); return; }
                StoreViewDto store = getTableView().getItems().get(getIndex());
                boolean yaGestionada = store.getTodayManagementResult() != null;
                btn.setText(yaGestionada ? "Gestionada" : "Gestionar");
                btn.setDisable(yaGestionada);
                btn.setStyle(yaGestionada
                        ? "-fx-background-color: #bdbdbd; -fx-text-fill: white; -fx-font-size: 11px; -fx-padding: 4 10; -fx-background-radius: 4;"
                        : "-fx-background-color: #e31837; -fx-text-fill: white; -fx-font-size: 11px; -fx-padding: 4 10; -fx-background-radius: 4; -fx-cursor: hand;");
                setGraphic(btn);
            }
        });

        tableStores.getColumns().addAll(
                nameCol, codeCol, phoneCol, agingCol, ordersCol,
                connectionCol, statusCol, tendenciaCol, gestionCol);

        // Color de fila por resultado de gestión
        tableStores.setRowFactory(tv -> new TableRow<>() {
            @Override protected void updateItem(StoreViewDto item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null || item.getTodayManagementResult() == null) {
                    setStyle(""); return;
                }
                setStyle(switch (item.getTodayManagementResult()) {
                    case "EXITOSA"              -> "-fx-background-color: #e8f5e9;";
                    case "NO_CONTACTO"          -> "-fx-background-color: #f0f0f0;";
                    case "NO_RESPONDE"          -> "-fx-background-color: #fff3e0;";
                    case "PROBLEMA_TECNICO"     -> "-fx-background-color: #fce4ec;";
                    case "REQUIERE_SEGUIMIENTO" -> "-fx-background-color: #e3f2fd;";
                    default -> "";
                });
            }
        });

        // Ctrl+C copia código + teléfono de la fila seleccionada
        tableStores.setOnKeyPressed(event -> {
            if (event.isControlDown() && event.getCode() == KeyCode.C) {
                StoreViewDto sel = tableStores.getSelectionModel().getSelectedItem();
                if (sel != null) copiarAlPortapapeles(sel.getStoreCode() + "\t" + sel.getPhoneNumber());
            }
        });
    }

    // ── Columnas tabla gestiones ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void setupGestionesTableColumns() {
        TableColumn<ManagementViewDto, String> timeCol = new TableColumn<>("Hora");
        timeCol.setCellValueFactory(new PropertyValueFactory<>("managementTime"));
        timeCol.setPrefWidth(60);

        TableColumn<ManagementViewDto, String> storeCol = new TableColumn<>("Tienda");
        storeCol.setCellValueFactory(new PropertyValueFactory<>("storeName"));
        storeCol.setPrefWidth(220);
        storeCol.setCellFactory(col -> copiableCellManagement());

        TableColumn<ManagementViewDto, String> codeCol2 = new TableColumn<>("Código");
        codeCol2.setCellValueFactory(new PropertyValueFactory<>("storeCode"));
        codeCol2.setPrefWidth(90);
        codeCol2.setCellFactory(col -> copiableCellManagement());

        TableColumn<ManagementViewDto, String> typeCol = new TableColumn<>("Canal");
        typeCol.setCellValueFactory(new PropertyValueFactory<>("managementType"));
        typeCol.setPrefWidth(120);

        TableColumn<ManagementViewDto, String> resultCol = new TableColumn<>("Resultado");
        resultCol.setCellValueFactory(new PropertyValueFactory<>("resultType"));
        resultCol.setPrefWidth(160);
        resultCol.setCellFactory(col -> new TableCell<>() {
            @Override protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) { setText(null); setStyle(""); return; }
                setText(item);
                setStyle(switch (item) {
                    case "EXITOSA"              -> "-fx-text-fill: #2e7d32; -fx-font-weight: bold;";
                    case "NO_CONTACTO"          -> "-fx-text-fill: #757575; -fx-font-weight: bold;";
                    case "NO_RESPONDE"          -> "-fx-text-fill: #e65100; -fx-font-weight: bold;";
                    case "PROBLEMA_TECNICO"     -> "-fx-text-fill: #c62828; -fx-font-weight: bold;";
                    case "REQUIERE_SEGUIMIENTO" -> "-fx-text-fill: #1565c0; -fx-font-weight: bold;";
                    default -> "";
                });
            }
        });

        TableColumn<ManagementViewDto, String> commentsCol = new TableColumn<>("Comentario");
        commentsCol.setCellValueFactory(new PropertyValueFactory<>("comments"));
        commentsCol.setPrefWidth(260);

        TableColumn<ManagementViewDto, Void> editCol = new TableColumn<>("");
        editCol.setPrefWidth(80);
        editCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button("Editar");
            {
                btn.setStyle("-fx-background-color: #1565c0; -fx-text-fill: white; " +
                             "-fx-font-size: 11px; -fx-padding: 4 10; " +
                             "-fx-background-radius: 4; -fx-cursor: hand;");
                btn.setOnAction(e -> abrirDialogoEdicion(getTableView().getItems().get(getIndex())));
            }
            @Override protected void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                setGraphic(empty ? null : btn);
            }
        });

        tableGestiones.getColumns().addAll(timeCol, storeCol, codeCol2, typeCol, resultCol, commentsCol, editCol);
    }

    // ── Helpers copy ──────────────────────────────────────────────────────────

    /** Celda de tienda con menú contextual Copiar. */
    private TableCell<StoreViewDto, String> copiableCell() {
        return new TableCell<>() {
            @Override protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) { setText(null); setContextMenu(null); return; }
                setText(item);
                agregarContextMenu(this, item);
            }
        };
    }

    private TableCell<ManagementViewDto, String> copiableCellManagement() {
        return new TableCell<>() {
            @Override protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) { setText(null); setContextMenu(null); return; }
                setText(item);
                agregarContextMenu(this, item);
            }
        };
    }

    private void agregarContextMenu(TableCell<?, ?> cell, String value) {
        ContextMenu menu = new ContextMenu();
        MenuItem copiar = new MenuItem("Copiar");
        copiar.setOnAction(e -> copiarAlPortapapeles(value));
        menu.getItems().add(copiar);
        cell.setContextMenu(menu);
    }

    private void copiarAlPortapapeles(String texto) {
        ClipboardContent content = new ClipboardContent();
        content.putString(texto);
        Clipboard.getSystemClipboard().setContent(content);
    }

    // ── Helpers búsqueda tienda ───────────────────────────────────────────────

    private String categoriaDe(StoreEntity store) {
        if (dashboardData == null) return "—";
        String id = String.valueOf(store.getId());
        if (dashboardData.getOnboardingCritical().stream().anyMatch(s -> s.getId().equals(store.getId()))) return "Onboarding crítico";
        if (dashboardData.getAliados().stream().anyMatch(s -> s.getId().equals(store.getId())))           return "Conexión Aliados <60%";
        if (dashboardData.getChurnRisk().stream().anyMatch(s -> s.getId().equals(store.getId())))          return "Riesgo Churn";
        if (dashboardData.getAvaDropping().stream().anyMatch(s -> s.getId().equals(store.getId())))        return "AVA bajando";
        if (dashboardData.getAvaLow().stream().anyMatch(s -> s.getId().equals(store.getId())))             return "AVA crítico 1-15%";
        if (dashboardData.getHealthy().stream().anyMatch(s -> s.getId().equals(store.getId())))            return "Saludable";
        return "—";
    }

    /**
     * Analiza la tendencia de conexión comparando AVA_L4W vs AVA_L7D.
     * Regla: si L7D cae más de 10pp respecto a L4W → CRÍTICA; si cae 5-10pp → BAJANDO; etc.
     */
    private String analizarConexion(Long storeId) {
        return dailyMetricJpaRepository
                .findTop1ByStore_IdOrderByMetricDateDesc(storeId)
                .map(m -> {
                    BigDecimal l4w = m.getConnectionPercentage();
                    BigDecimal l7d = m.getAvaL7d();
                    String rappiStatus = m.getAvaStatus() != null ? m.getAvaStatus() : "—";

                    String l4wStr = l4w != null ? String.format("%.2f%%", l4w.doubleValue()) : "—";
                    String l7dStr = l7d != null ? String.format("%.2f%%", l7d.doubleValue()) : "—";

                    if (l4w == null || l7d == null) {
                        return String.format("AVA L4W: %s  |  AVA L7D: %s%nRappi: %s%n(Sin datos suficientes para analizar)", l4wStr, l7dStr, rappiStatus);
                    }

                    double diff = l7d.doubleValue() - l4w.doubleValue();
                    String estado;
                    String recomendacion;

                    if (diff > 5) {
                        estado = "MEJORANDO";
                        recomendacion = "La tienda esta ganando conexion esta semana. Sin accion urgente.";
                    } else if (diff >= -5) {
                        estado = "ESTABLE";
                        recomendacion = "Variacion normal. Monitorear en el proximo Excel.";
                    } else if (diff >= -10) {
                        estado = "BAJANDO";
                        recomendacion = "Caida leve en los ultimos 7 dias. Hacer seguimiento pronto.";
                    } else {
                        estado = "CRITICA";
                        recomendacion = String.format(
                                "CAIDA DE %.1f pp EN 7 DIAS. Contactar de inmediato.", Math.abs(diff));
                    }

                    return String.format(
                            "AVA L4W: %s  |  AVA L7D: %s  |  Diferencia: %+.1f pp%n" +
                            "Estado Rappi: %s%n" +
                            "Diagnostico: %s%n" +
                            "%s",
                            l4wStr, l7dStr, diff, rappiStatus, estado, recomendacion);
                })
                .orElse("Sin métricas de conexión registradas.");
    }

    private String infoUltimaGestion(Long storeId) {
        return managementJpaRepository
                .findLatestByStoreId(storeId, PageRequest.of(0, 1))
                .stream().findFirst()
                .map(m -> {
                    LocalDate hoy = LocalDate.now();
                    LocalDate fechaGestion = m.getManagementDate().toLocalDate();
                    long diasAtras = ChronoUnit.DAYS.between(fechaGestion, hoy);

                    String detalle = m.getResultType() + " vía " + m.getManagementType();
                    if (diasAtras == 0) return "Hoy — " + detalle;
                    if (diasAtras == 1) return "Ayer — " + detalle;
                    return "Hace " + diasAtras + " días ("
                            + fechaGestion.format(DateTimeFormatter.ofPattern("dd/MM")) + ") — " + detalle;
                })
                .orElse("Sin gestiones registradas");
    }

    private StoreViewDto encontrarStoreViewDto(Long storeId) {
        if (dashboardData == null) return null;
        return dashboardData.allStores().stream()
                .filter(s -> s.getId().equals(storeId))
                .findFirst()
                .orElse(null);
    }

    private int calcAging(LocalDate onboardingDate) {
        if (onboardingDate == null) return 0;
        return (int) java.time.temporal.ChronoUnit.DAYS.between(onboardingDate, LocalDate.now());
    }

    // ── Helpers UI ────────────────────────────────────────────────────────────

    private void mostrarProgreso(String msg) {
        progressIndicator.setVisible(true); progressIndicator.setManaged(true);
        lblEstado.setText(msg);
        lblEstado.setStyle("-fx-font-size: 12px; -fx-text-fill: white;");
        lblEstado.setVisible(true); lblEstado.setManaged(true);
        btnCargarExcel.setDisable(true);
    }
    private void ocultarProgreso() {
        progressIndicator.setVisible(false); progressIndicator.setManaged(false);
        btnCargarExcel.setDisable(false);
    }
    private void mostrarEstado(String msg) {
        lblEstado.setText(msg);
        lblEstado.setStyle("-fx-font-size: 12px; -fx-text-fill: white;");
        lblEstado.setVisible(true); lblEstado.setManaged(true);
    }
    private void mostrarError(String msg) {
        lblEstado.setText(msg);
        lblEstado.setStyle("-fx-font-size: 12px; -fx-text-fill: #ffcdd2;");
        lblEstado.setVisible(true); lblEstado.setManaged(true);
    }
}
