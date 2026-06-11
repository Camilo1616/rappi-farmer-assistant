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

    private static final String GROQ_URL =
        "https://api.groq.com/openai/v1/chat/completions";

    private static final String MODEL = "llama-3.3-70b-versatile";

    private final String apiKey;
    private final RestTemplate restTemplate = new RestTemplate();

    public AiService(@Value("${groq.api.key:}") String apiKey) {
        this.apiKey = apiKey;
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GROQ_API_KEY no configurada — funciones de IA desactivadas");
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

        return callGroq(prompt);
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

        return callGroq(prompt);
    }

    private String callGroq(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("IA no disponible: configura GROQ_API_KEY");
        }

        Map<String, Object> body = Map.of(
            "model", MODEL,
            "messages", List.of(
                Map.of("role", "user", "content", prompt)
            ),
            "max_tokens", 500
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                GROQ_URL,
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                Map.class
            );

            var choices = (List<?>) response.getBody().get("choices");
            var message = (Map<?, ?>) ((Map<?, ?>) choices.get(0)).get("message");
            return (String) message.get("content");
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Error Groq API {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Error IA " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("Error inesperado llamando Groq: {}", e.getMessage());
            throw new RuntimeException("Error IA: " + e.getMessage());
        }
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }
}
