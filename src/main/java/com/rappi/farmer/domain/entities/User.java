package com.rappi.farmer.domain.entities;

import com.rappi.farmer.domain.enums.RappiCountry;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private static final String RAPPI_DOMAIN = "@rappi.com";
    private Long id;
    private String fullName;
    private String email;
    private String role;
    private String passwordHash;
    private String farmerCode;
    private String countryCode;
    private String accountStatus;
    private Long liderId;
    private String nickname;
    private String avatarUrl;
    private String calendarRefreshToken;
    private LocalDateTime lastLoginAt;
    private LocalDate lastImportDate;
    private LocalDateTime lastActivity;
    private String activityStatus;
    private java.time.LocalDate whatsappPhoneRegisteredAt;

    public UserRole getUserRole() {
        try { return UserRole.valueOf(role); } catch (Exception e) { return UserRole.FARMER_MASS; }
    }

    public UserStatus getStatus() {
        try { return UserStatus.valueOf(accountStatus); } catch (Exception e) { return UserStatus.ACTIVE; }
    }

    public boolean isActive() { return UserStatus.ACTIVE == getStatus(); }

    public static boolean isRappiEmail(String email) {
        return email != null && email.toLowerCase().endsWith(RAPPI_DOMAIN);
    }

    public boolean hasCalendarConnected() {
        return calendarRefreshToken != null;
    }

    /** countryCode se guarda como CSV (ej: "CO,PE,MX"). Líderes pueden tener varios países. */
    public List<String> countries() {
        if (countryCode == null || countryCode.isBlank()) return new ArrayList<>();
        List<String> result = new ArrayList<>(Arrays.asList(countryCode.split(",")));
        result.removeIf(String::isBlank);
        return result;
    }

    /** Agrega un país al CSV si no lo tiene ya (usado para Líderes multi-país). */
    public void addCountry(String country) {
        List<String> countries = countries();
        if (!countries.contains(country)) countries.add(country);
        countryCode = String.join(",", countries);
    }

    /** Quita un país del CSV (comparación case-insensitive). */
    public void removeCountry(String country) {
        List<String> countries = countries();
        countries.removeIf(c -> c.trim().equalsIgnoreCase(country));
        countryCode = String.join(",", countries);
    }

    /** true si es el primer login registrado (aún no tiene lastLoginAt). */
    public boolean isFirstLogin() {
        return lastLoginAt == null;
    }

    public void markActive() {
        lastActivity = LocalDateTime.now();
        activityStatus = "ACTIVO";
    }

    public void markLoggedOut() {
        activityStatus = "DESACTIVADO";
    }

    /** true si estuvo ACTIVO pero no ha dado señales de vida desde el umbral dado. */
    public boolean isIdleSince(LocalDateTime threshold) {
        return "ACTIVO".equals(activityStatus)
                && lastActivity != null
                && lastActivity.isBefore(threshold);
    }

    public void markInactive() {
        activityStatus = "INACTIVO";
    }
}
