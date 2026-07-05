package com.rappi.assistant.presentation.api;

import com.rappi.assistant.application.services.UserService;
import com.rappi.assistant.domain.entities.User;
import com.rappi.assistant.domain.enums.UserRole;
import com.rappi.assistant.domain.exceptions.BusinessException;
import com.rappi.assistant.domain.repositories.UserRepository;
import com.rappi.assistant.infrastructure.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private static final String UPLOADS_DIR = System.getProperty("user.home") + "/rappi-uploads/avatars/";

    private final UserRepository userRepository;
    private final UserService userService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    public ResponseEntity<?> getProfile(@RequestHeader("Authorization") String authHeader) {
        return ResponseEntity.ok(toDto(resolveUser(authHeader)));
    }

    @PatchMapping("/nickname")
    public ResponseEntity<?> updateNickname(@RequestBody NicknameRequest req,
            @RequestHeader("Authorization") String authHeader) {
        User user = resolveUser(authHeader);
        user.setNickname(req.nickname() == null || req.nickname().isBlank() ? null : req.nickname().trim());
        return ResponseEntity.ok(toDto(userRepository.save(user)));
    }

    @PostMapping("/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") MultipartFile file,
            @RequestHeader("Authorization") String authHeader) throws IOException {
        User user = resolveUser(authHeader);

        String ext = getExtension(file.getOriginalFilename());
        if (!ext.matches("jpg|jpeg|png|webp|gif")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Solo se aceptan imágenes (jpg, png, webp)"));
        }

        Path dir = Paths.get(UPLOADS_DIR);
        Files.createDirectories(dir);

        if (user.getAvatarUrl() != null) {
            String oldFile = user.getAvatarUrl().replace("/api/profile/avatar/", "");
            try { Files.deleteIfExists(dir.resolve(oldFile)); } catch (Exception ignored) {}
        }

        String filename = user.getId() + "_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
        Files.copy(file.getInputStream(), dir.resolve(filename));

        user.setAvatarUrl("/api/profile/avatar/" + filename);
        return ResponseEntity.ok(toDto(userRepository.save(user)));
    }

    @GetMapping("/avatar/{filename}")
    public ResponseEntity<byte[]> getAvatar(@PathVariable String filename) throws IOException {
        Path path = Paths.get(UPLOADS_DIR, filename);
        if (!Files.exists(path)) return ResponseEntity.notFound().build();
        String ext = getExtension(filename);
        String contentType = ext.equals("png") ? "image/png" : ext.equals("webp") ? "image/webp" : "image/jpeg";
        return ResponseEntity.ok()
                .header("Content-Type", contentType)
                .header("Cache-Control", "max-age=86400")
                .body(Files.readAllBytes(path));
    }

    @PatchMapping("/{targetId}/promote")
    public ResponseEntity<?> promote(@PathVariable Long targetId,
            @RequestHeader("Authorization") String authHeader) {
        User caller = resolveUser(authHeader);
        if (caller.getUserRole() != UserRole.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Solo un Administrador puede promover usuarios"));
        }
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        target.setRole(UserRole.ADMIN.name());
        userRepository.save(target);
        return ResponseEntity.ok(Map.of("message", target.getFullName() + " ahora es Administrador"));
    }

    @PatchMapping("/{targetId}/demote")
    public ResponseEntity<?> demote(@PathVariable Long targetId,
            @RequestHeader("Authorization") String authHeader) {
        User caller = resolveUser(authHeader);
        if (caller.getUserRole() != UserRole.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Solo el Administrador puede bajar de rol"));
        }
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        if (target.getId().equals(caller.getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "No puedes bajarte el rol a ti mismo"));
        }
        target.setRole(UserRole.USER.name());
        userRepository.save(target);
        return ResponseEntity.ok(Map.of("message", target.getFullName() + " ahora es Usuario"));
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body,
            @RequestHeader("Authorization") String authHeader) {
        User user = resolveUser(authHeader);
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Contraseña actual incorrecta"));
        }
        if (newPassword == null || newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("message", "La nueva contraseña debe tener al menos 6 caracteres"));
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Contraseña actualizada"));
    }

    @GetMapping("/users")
    public ResponseEntity<?> getUsers(@RequestHeader("Authorization") String authHeader) {
        User caller = resolveUser(authHeader);
        if (caller.getUserRole() != UserRole.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Acceso denegado"));
        }
        return ResponseEntity.ok(userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(caller.getId()))
                .map(this::toDto).toList());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private User resolveUser(String authHeader) {
        String token = authHeader.substring(7);
        String email = jwtService.extractEmail(token);
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
    }

    private Map<String, Object> toDto(User u) {
        Map<String, Object> map = new HashMap<>();
        map.put("id",          u.getId());
        map.put("fullName",    u.getFullName());
        map.put("email",       u.getEmail());
        map.put("role",        u.getRole());
        map.put("roleLabel",   u.getUserRole().displayName());
        map.put("nickname",    u.getNickname() != null ? u.getNickname() : "");
        map.put("avatarUrl",   u.getAvatarUrl() != null ? u.getAvatarUrl() : "");
        return map;
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "jpg";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    public record NicknameRequest(String nickname) {}
}
