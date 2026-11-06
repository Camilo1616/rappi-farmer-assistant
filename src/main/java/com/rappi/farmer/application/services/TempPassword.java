package com.rappi.farmer.application.services;

import java.security.SecureRandom;

/**
 * Contraseñas temporales: 12 caracteres al azar (SecureRandom) sin letras ambiguas (0/O, 1/l/I),
 * para que se puedan leer del correo y escribir sin errores. Siempre trae mayúscula, minúscula y número.
 */
public final class TempPassword {

    private static final String UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghijkmnopqrstuvwxyz";
    private static final String DIGITS = "23456789";
    private static final String ALL = UPPER + LOWER + DIGITS;
    private static final SecureRandom RANDOM = new SecureRandom();
    public static final int LENGTH = 12;

    private TempPassword() {}

    public static String generate() {
        char[] out = new char[LENGTH];
        out[0] = pick(UPPER);
        out[1] = pick(LOWER);
        out[2] = pick(DIGITS);
        for (int i = 3; i < LENGTH; i++) out[i] = pick(ALL);
        // Mezcla (Fisher-Yates) para que las posiciones obligatorias no sean predecibles
        for (int i = LENGTH - 1; i > 0; i--) {
            int j = RANDOM.nextInt(i + 1);
            char t = out[i]; out[i] = out[j]; out[j] = t;
        }
        return new String(out);
    }

    private static char pick(String set) {
        return set.charAt(RANDOM.nextInt(set.length()));
    }
}
