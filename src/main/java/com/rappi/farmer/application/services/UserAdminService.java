package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.CreateUserRequest;
import com.rappi.farmer.application.dtos.PanelUserDto;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.enums.UserStatus;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.domain.services.MailSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

/**
 * "Usuarios y roles" del panel de ventas. Al crear un usuario (o reenviar su acceso) el sistema genera
 * una contraseña temporal, la guarda cifrada y la envía al correo del usuario; la contraseña nunca se
 * muestra en pantalla y el usuario debe cambiarla al entrar. Si el correo no sale, no queda nada guardado.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserAdminService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordEncoder encoder;
    private final MailSender mailSender;

    @Value("${mail.app-name:J.Bell}")
    private String appName = "J.Bell";

    @Value("${app.public-url:}")
    private String publicUrl = "";

    /** ADMIN y DUENA gestionan a todo el panel; ASISTENTE solo a otros asistentes. */
    public static boolean canManage(UserRole actor, UserRole target) {
        if (actor == null || target == null || !target.isPanelRole()) return false;
        return switch (actor) {
            case ADMIN, DUENA -> true;
            case ASISTENTE -> target == UserRole.ASISTENTE;
            default -> false;
        };
    }

    public static String roleLabel(UserRole r) {
        return switch (r) {
            case DUENA -> "Propietaria";
            case ASISTENTE -> "Asistente de cartera";
            default -> r.displayName();
        };
    }

    @Transactional(readOnly = true)
    public List<PanelUserDto> list(Long actorId) {
        UserRole actor = actorRole(actorId);
        return userRepository.findAll().stream()
                .filter(u -> u.getUserRole().isPanelRole())
                .sorted(Comparator.comparing(User::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(u -> toDto(u, canManage(actor, u.getUserRole())))
                .toList();
    }

    @Transactional
    public PanelUserDto create(Long actorId, String fullName, String email, String role) {
        UserRole actor = actorRole(actorId);
        UserRole target = parsePanelRole(role);
        requireCanManage(actor, target);
        if (fullName == null || fullName.isBlank()) throw new BusinessException("El nombre es obligatorio");
        String mail = email == null ? "" : email.trim().toLowerCase();
        if (!EMAIL.matcher(mail).matches()) throw new BusinessException("El correo no tiene un formato válido");
        if (userRepository.existsByEmail(mail)) throw new BusinessException("Ya existe un usuario con ese correo");

        String temp = TempPassword.generate();
        CreateUserRequest req = new CreateUserRequest();
        req.setFullName(fullName.trim());
        req.setEmail(mail);
        req.setPassword(temp);
        req.setRole(target.name());
        User saved = userService.createUser(req);
        saved.setMustChangePassword(true);
        saved = userRepository.save(saved);

        sendAccess(saved, temp, true);
        log.info("Usuario del panel creado: {} ({}) por usuario {}", saved.getEmail(), target, actorId);
        return toDto(saved, true);
    }

    /** Genera una contraseña temporal nueva y la envía (por ejemplo, si olvidó la suya o no le llegó el correo). */
    @Transactional
    public void resendAccess(Long actorId, Long userId) {
        User target = manageable(actorId, userId);
        String temp = TempPassword.generate();
        target.setPasswordHash(encoder.encode(temp));
        target.setMustChangePassword(true);
        userRepository.save(target);
        sendAccess(target, temp, false);
        log.info("Acceso reenviado a {} por usuario {}", target.getEmail(), actorId);
    }

    @Transactional
    public PanelUserDto setActive(Long actorId, Long userId, boolean active) {
        if (actorId.equals(userId)) throw new BusinessException("No puedes desactivar tu propio usuario");
        User target = manageable(actorId, userId);
        target.setAccountStatus(active ? UserStatus.ACTIVE.name() : UserStatus.SUSPENDED.name());
        return toDto(userRepository.save(target), true);
    }

    @Transactional
    public PanelUserDto changeRole(Long actorId, Long userId, String role) {
        if (actorId.equals(userId)) throw new BusinessException("No puedes cambiar tu propio rol");
        User target = manageable(actorId, userId);
        UserRole newRole = parsePanelRole(role);
        requireCanManage(actorRole(actorId), newRole);
        target.setRole(newRole.name());
        return toDto(userRepository.save(target), true);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void sendAccess(User user, String tempPassword, boolean isNew) {
        String link = publicUrl == null || publicUrl.isBlank() ? "" : "\nEntra aquí: " + publicUrl.trim() + "\n";
        String body = "Hola " + user.getFullName() + ",\n\n"
                + (isNew ? "Se creó tu usuario en " + appName + "." : "Se restableció tu acceso a " + appName + ".") + "\n"
                + link + "\n"
                + "Correo: " + user.getEmail() + "\n"
                + "Contraseña temporal: " + tempPassword + "\n\n"
                + "Por seguridad, al entrar el sistema te pedirá crear una contraseña nueva.\n"
                + "Si no esperabas este correo, ignóralo y avisa a quien administra los usuarios.\n\n— " + appName;
        // Si falla, la excepción revierte la transacción: el usuario no queda creado a medias
        mailSender.send(user.getEmail(), (isNew ? "Tu acceso a " : "Nueva contraseña temporal de ") + appName, body);
    }

    private User manageable(Long actorId, Long userId) {
        User target = userRepository.findById(userId).orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        requireCanManage(actorRole(actorId), target.getUserRole());
        return target;
    }

    private UserRole actorRole(Long actorId) {
        return userRepository.findById(actorId).map(User::getUserRole)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
    }

    private static void requireCanManage(UserRole actor, UserRole target) {
        if (!canManage(actor, target)) throw new BusinessException("No tienes permiso para administrar ese rol");
    }

    private static UserRole parsePanelRole(String role) {
        try {
            UserRole r = UserRole.valueOf(role);
            if (r.isPanelRole()) return r;
        } catch (IllegalArgumentException | NullPointerException ignored) { /* cae al error */ }
        throw new BusinessException("Rol inválido");
    }

    private static PanelUserDto toDto(User u, boolean canManage) {
        return new PanelUserDto(u.getId(), u.getFullName(), u.getEmail(), u.getUserRole().name(), roleLabel(u.getUserRole()),
                u.isActive(), u.isMustChangePassword(), u.getLastLoginAt(), canManage);
    }
}
