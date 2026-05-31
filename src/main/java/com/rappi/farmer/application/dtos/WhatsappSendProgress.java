package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class WhatsappSendProgress {
    private int total;
    private int procesados;
    private int enviados;
    private int errores;
    private String storeName;
    private String status;   // ENVIANDO, ENVIADO, ERROR, NUMERO_INVALIDO, COMPLETADO
    private boolean finalizado;
}
