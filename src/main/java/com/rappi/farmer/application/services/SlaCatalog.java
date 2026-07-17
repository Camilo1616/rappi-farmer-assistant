package com.rappi.farmer.application.services;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Catálogo de SLA por categoría de tarea AGM — cuántas horas tiene el agente para resolverla
 * antes de que se considere vencida (fuente: tabla de SLAs del equipo de operaciones).
 * TIPO_SOPORTE/EXPLICACION en el Sheet no usa siempre el mismo texto que el catálogo interno de
 * procesos, así que el match es por solapamiento de palabras clave, no por igualdad exacta.
 */
public final class SlaCatalog {

    public record SlaInfo(String categoria, int slaHoras) {}

    private record Regla(String categoria, int slaHoras, List<String> keywords) {}

    private static final int HORAS_DIA = 24;

    private static final List<Regla> REGLAS = List.of(
            new Regla("Configuración Básica", 24, List.of(
                    "HAS_LOGO", "HAS_BACKGROUND", "HAS_SCHEDULES", "validar_horarios",
                    "validar_categoria", "validar_direccion", "confirmar_brand_name")),
            new Regla("Configuración de Cuenta", 24, List.of(
                    "CUENTA_VALIDADA", "confirmar_cuenta_bancaria", "frecuencia_pagos", "cuenta bancaria")),
            new Regla("Publicación", 24, List.of(
                    "IS_PUBLISHED_RAW", "Publicar tienda", "publicacion")),
            new Regla("HO y Contactabilidad", 24, List.of(
                    "FALLBACK_COMERCIAL_CONTACTO_EXITOSO_PENDIENTE_HO", "FALLBACK_COMERCIAL_IMPOSIBLE_CONTACTO",
                    "contacto exitoso pendiente ho", "imposible contacto")),
            new Regla("Activación Fallback", 24, List.of(
                    "Fallback Login", "Fallback Activacion", "first_login")),
            new Regla("Credenciales y Accesos", 48, List.of(
                    "PASA_CREDENCIALES", "Crear credenciales RappiAliados",
                    "first_login_portal_partners", "first_login_rappi_aliados")),
            new Regla("Polígonos", 48, List.of("PASA_POLYGONS", "Generar poligonos")),
            new Regla("Suspensión", 48, List.of("PASA_SUSPENDED", "Quitar suspension")),
            new Regla("Deuda", 30 * HORAS_DIA, List.of("PASA_DEUDA", "Crear ticket con deuda")),
            new Regla("Cambios Contractuales y Config. Comercial", 30 * HORAS_DIA, List.of(
                    "tipo_entrega",
                    "Solicitar ajuste en pago validar cuenta",
                    "Solicitar ajuste en pago contrato",
                    "Solicitar ajuste en pago take rate"))
    );

    private static final SlaInfo DEFAULT = new SlaInfo("Sin categorizar", 48);

    private SlaCatalog() {}

    public static SlaInfo resolve(String tipoSoporte, String explicacion) {
        Set<String> target = tokenize((tipoSoporte == null ? "" : tipoSoporte) + " " + (explicacion == null ? "" : explicacion));
        if (target.isEmpty()) return DEFAULT;

        Regla mejor = null;
        int mejorScore = 0;
        for (Regla r : REGLAS) {
            int score = 0;
            for (String kw : r.keywords()) {
                Set<String> kwTokens = tokenize(kw);
                kwTokens.retainAll(target);
                score += kwTokens.size();
            }
            if (score > mejorScore) {
                mejorScore = score;
                mejor = r;
            }
        }
        return mejor == null ? DEFAULT : new SlaInfo(mejor.categoria(), mejor.slaHoras());
    }

    private static final Pattern SEPARADORES = Pattern.compile("[^\\p{L}\\p{N}]+");
    private static final Set<String> STOPWORDS = Set.of(
            "DE", "LA", "EL", "EN", "Y", "A", "CON", "PARA", "TIENDA", "PENDIENTE", "ESTE", "ESTA", "QUE", "LOS", "LAS");

    private static Set<String> tokenize(String s) {
        if (s == null || s.isBlank()) return Set.of();
        String norm = Normalizer.normalize(s.toUpperCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        Set<String> tokens = new HashSet<>();
        for (String t : SEPARADORES.split(norm)) {
            if (t.length() >= 3 && !STOPWORDS.contains(t)) tokens.add(t);
        }
        return tokens;
    }
}
