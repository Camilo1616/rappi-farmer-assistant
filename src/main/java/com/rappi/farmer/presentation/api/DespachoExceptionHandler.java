package com.rappi.farmer.presentation.api;

import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.exceptions.InsufficientStockException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Errores de negocio del modulo de despacho (despacho, cultivos y viajes). */
@RestControllerAdvice(assignableTypes = {DispatchController.class, CultivoController.class, TripController.class, CollectionController.class, ClientProfileController.class})
public class DespachoExceptionHandler {

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<?> noStock(InsufficientStockException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "code", "NO_STOCK", "message", e.getMessage(), "maxAllowed", e.getMaxAllowed()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<?> business(BusinessException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
