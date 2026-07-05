package com.rappi.assistant.domain.entities;

import com.rappi.assistant.domain.enums.UserRole;
import com.rappi.assistant.domain.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private Long id;
    private String fullName;
    private String email;
    private String role;
    private String passwordHash;
    private String accountStatus;
    private String nickname;
    private String avatarUrl;
    private LocalDateTime lastLoginAt;
    private LocalDateTime lastActivity;
    private String activityStatus;
    private LocalDate whatsappPhoneRegisteredAt;

    public UserRole getUserRole() {
        try { return UserRole.valueOf(role); } catch (Exception e) { return UserRole.USER; }
    }

    public UserStatus getStatus() {
        try { return UserStatus.valueOf(accountStatus); } catch (Exception e) { return UserStatus.ACTIVE; }
    }

    public boolean isActive() { return UserStatus.ACTIVE == getStatus(); }
}
