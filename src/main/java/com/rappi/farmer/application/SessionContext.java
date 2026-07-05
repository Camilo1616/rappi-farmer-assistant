package com.rappi.farmer.application;

import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
@RequiredArgsConstructor
public class SessionContext {

    private final UserRepository userRepository;

    private Long currentUserId;
    private String currentUserName;
    private String currentUserEmail;
    private UserRole currentUserRole;
    private boolean populated;

    public Long getCurrentUserId() {
        ensurePopulated();
        return currentUserId;
    }

    public String getCurrentUserName() {
        ensurePopulated();
        return currentUserName;
    }

    public String getCurrentUserEmail() {
        ensurePopulated();
        return currentUserEmail;
    }

    public UserRole getCurrentUserRole() {
        ensurePopulated();
        return currentUserRole;
    }

    public boolean isLider() {
        return UserRole.LIDER == getCurrentUserRole();
    }

    private void ensurePopulated() {
        if (populated) return;
        populated = true;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) return;
        String email = auth.getName();
        String role = auth.getAuthorities().stream()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .findFirst().orElse("FARMER_MASS");
        userRepository.findByEmail(email).ifPresent(user -> {
            this.currentUserId = user.getId();
            this.currentUserName = user.getFullName();
            this.currentUserEmail = email;
            try { this.currentUserRole = UserRole.valueOf(role); }
            catch (Exception e) { this.currentUserRole = UserRole.FARMER_MASS; }
        });
    }
}
