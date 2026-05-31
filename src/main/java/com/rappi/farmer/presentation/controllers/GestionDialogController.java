package com.rappi.farmer.presentation.controllers;

import com.rappi.farmer.application.dtos.ManagementViewDto;
import com.rappi.farmer.application.dtos.RegisterManagementRequest;
import com.rappi.farmer.application.dtos.StoreViewDto;
import com.rappi.farmer.application.services.ManagementService;
import javafx.fxml.FXML;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Scope("prototype")
@RequiredArgsConstructor
public class GestionDialogController {

    private final ManagementService managementService;

    @FXML private Label lblStoreName;
    @FXML private ComboBox<String> cboManagementType;
    @FXML private ComboBox<String> cboResultType;
    @FXML private TextArea txtComments;
    @FXML private Label lblError;

    private StoreViewDto store;
    private Long existingManagementId = null;
    private Runnable onSaved;

    @FXML
    public void initialize() {
        cboManagementType.getItems().addAll(
                "WHATSAPP", "LLAMADA", "CORREO", "VIDEOCONFERENCIA");
        cboResultType.getItems().addAll(
                "EXITOSA", "NO_CONTACTO");
        cboManagementType.getSelectionModel().selectFirst();
        cboResultType.getSelectionModel().selectFirst();
    }

    /** Modo creación: se llama cuando la tienda no tiene gestión hoy. */
    public void setStore(StoreViewDto store) {
        this.store = store;
        this.existingManagementId = null;
        lblStoreName.setText(store.getStoreName() + " — " + store.getStoreCode());
    }

    /** Modo edición: se llama desde la tabla de gestiones del día. */
    public void setExistingManagement(ManagementViewDto dto) {
        this.existingManagementId = dto.getId();
        lblStoreName.setText(dto.getStoreName() + " — " + dto.getStoreCode());
        cboManagementType.setValue(dto.getManagementType());
        cboResultType.setValue(dto.getResultType());
        txtComments.setText(dto.getComments() != null ? dto.getComments() : "");
    }

    public void setOnSaved(Runnable onSaved) {
        this.onSaved = onSaved;
    }

    @FXML
    public void onGuardar() {
        if (cboManagementType.getValue() == null || cboResultType.getValue() == null) {
            mostrarError("Selecciona canal y resultado.");
            return;
        }
        try {
            if (existingManagementId != null) {
                // Modo edición
                managementService.update(
                        existingManagementId,
                        cboManagementType.getValue(),
                        cboResultType.getValue(),
                        txtComments.getText());
            } else {
                // Modo creación
                managementService.register(RegisterManagementRequest.builder()
                        .storeId(store.getId())
                        .managementType(cboManagementType.getValue())
                        .resultType(cboResultType.getValue())
                        .comments(txtComments.getText())
                        .build());
            }
            if (onSaved != null) onSaved.run();
            cerrar();
        } catch (Exception e) {
            log.error("Error al guardar gestión", e);
            mostrarError("Error al guardar: " + e.getMessage());
        }
    }

    @FXML
    public void onCancelar() {
        cerrar();
    }

    private void mostrarError(String msg) {
        lblError.setText(msg);
        lblError.setVisible(true);
        lblError.setManaged(true);
    }

    private void cerrar() {
        txtComments.getScene().getWindow().hide();
    }
}
