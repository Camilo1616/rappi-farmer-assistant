package com.rappi.farmer.domain.entities;

import com.rappi.farmer.domain.enums.RappiCountry;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
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

    public UserRole getUserRole() {
        try { return UserRole.valueOf(role); } catch (Exception e) { return UserRole.FARMER_MASS; }
    }

    public UserStatus getStatus() {
        try { return UserStatus.valueOf(accountStatus); } catch (Exception e) { return UserStatus.ACTIVE; }
    }

    public boolean isActive() { return UserStatus.ACTIVE == getStatus(); }
}
