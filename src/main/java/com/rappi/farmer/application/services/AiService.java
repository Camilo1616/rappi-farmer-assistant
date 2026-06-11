package com.rappi.farmer.application.services;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class AiService {

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=";

    private final String apiKey;
    private final RestTemplate restTemplate = new RestTemplate();

    public AiService(@Value("${gemini.api.key:}") String apiKey) {
        this.apiKey = apiKey;
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GEMINI_API_KEY no configurada — funciones de IA desactivadas");
        }
    }

    /**
     * Genera un mensaje personalizado de WhatsApp para una tienda.
     */
    public String generateWhatsappMessage(String storeName, String ownerName,
                                          int agingDays, String situation,
                                          String baseTemplate) {
        String prompt = String.format("""
                Eres asistente de Account Manager de Rappi Colombia.
                Personaliza este mensaje de WhatsApp para la tienda:
                - Restaurante: %s
                - Dueño: %s
                - Días desde onboarding: %d
                - Situación: %s
                - Plantilla base: %s

                Responde SOLO con el mensaje listo para enviar.
                Tono amigable y profesional. Máximo 300 caracteres.
                """, storeName, ownerName, agingDays, situation, baseTemplate);

        return callGemini(prompt);
    }

    /**
     * Genera un resumen diario de gestión para el farmer.
     */
    public String generateDailySummary(int efectivas, int noContacto, int whatsappEnviados,
                                       int tiendas, String topPrioridades) {
        String prompt = String.format("""
                Genera un resumen del día de gestión de un Account Manager de Rappi:
                - Gestiones efectivas: %d (meta: 15)
                - No contactos: %d (meta: 25-40)
                - WhatsApp enviados: %d (máx: 40)
                - Total tiendas activas: %d
                - Top prioridades pendientes: %s

                Incluye: desempeño vs metas, observaciones clave, recomendaciones para mañana.
                Sé conciso (máx 200 palabras), usa bullets y emojis moderadamente.
                """, efectivas, noContacto, whatsappEnviados, tiendas, topPrioridades);

        return callGemini(prompt);
    }

    private String callGemini(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("IA no disponible: configura GEMINI_API_KEY");
        }

        Map<String, Object> body = Map.of(
            "contents", List.of(
                Map.of("parts", List.of(Map.of("text", prompt)))
            )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> response = restTemplate.exchange(
            GEMINI_URL + apiKey,
            HttpMethod.POST,
            new HttpEntity<>(body, headers),
            Map.class
        );

        try {
            var candidates = (List<?>) response.getBody().get("candidates");
            var content    = (Map<?, ?>) ((Map<?, ?>) candidates.get(0)).get("content");
            var parts      = (List<?>) content.get("parts");
            return (String) ((Map<?, ?>) parts.get(0)).get("text");
        } catch (Exception e) {
            throw new RuntimeException("Respuesta inesperada de Gemini: " + e.getMessage());
        }
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }
}
