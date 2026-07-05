package com.rappi.assistant.application.dtos;

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
    private String status;   // ENVIANDO, ENVIADO, ERROR, NUMERO_INVALIDO, ESPERANDO, COMPLETADO
    private boolean finalizado;
    private int waitSeconds; // segundos de espera (solo cuando status=ESPERANDO)

    /** Constructor sin waitSeconds para compatibilidad */
    public WhatsappSendProgress(int total, int procesados, int enviados, int errores,
                                 String storeName, String status, boolean finalizado) {
        this(total, procesados, enviados, errores, storeName, status, finalizado, 0);
    }
}
