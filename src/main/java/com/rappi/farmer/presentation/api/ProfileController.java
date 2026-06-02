package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.UserService;
import com.rappi.farmer.domain.entities.User;
import com.rappi.farmer.domain.enums.UserRole;
import com.rappi.farmer.domain.exceptions.BusinessException;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.infrastructure.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
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

        // Borra avatar anterior si existe
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
        if (!isManagerRole(caller)) {
            return ResponseEntity.status(403).body(Map.of("message", "Solo un Líder o Administrador puede promover usuarios"));
        }
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        target.setRole(UserRole.LIDER.name());
        userRepository.save(target);
        return ResponseEntity.ok(Map.of("message", target.getFullName() + " ahora es Líder"));
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
        target.setRole(UserRole.FARMER_MASS.name());
        userRepository.save(target);
        return ResponseEntity.ok(Map.of("message", target.getFullName() + " ahora es Farmer Mass"));
    }

    @PatchMapping("/{targetId}/country")
    public ResponseEntity<?> assignCountry(@PathVariable Long targetId,
            @RequestBody CountryRequest req,
            @RequestHeader("Authorization") String authHeader) {
        User caller = resolveUser(authHeader);
        if (!isManagerRole(caller)) {
            return ResponseEntity.status(403).body(Map.of("message", "Solo un Líder o Administrador puede asignar países"));
        }
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        String newCountry = req.countryCode().toUpperCase();

        if (target.getUserRole() == UserRole.LIDER) {
            // Para líderes: agrega el país si no lo tiene ya
            String existing = target.getCountryCode() != null ? target.getCountryCode() : "";
            java.util.List<String> countries = new java.util.ArrayList<>(
                java.util.Arrays.asList(existing.split(",")));
            countries.removeIf(String::isBlank);
            if (!countries.contains(newCountry)) countries.add(newCountry);
            target.setCountryCode(String.join(",", countries));
        } else {
            target.setCountryCode(newCountry);
            target.setFarmerCode(userService.generateFarmerCode(newCountry));
        }
        userRepository.save(target);
        return ResponseEntity.ok(Map.of("message", "País " + newCountry + " asignado", "countryCode", target.getCountryCode()));
    }

    @DeleteMapping("/{targetId}/country/{code}")
    public ResponseEntity<?> removeCountry(@PathVariable Long targetId,
            @PathVariable String code,
            @RequestHeader("Authorization") String authHeader) {
        User caller = resolveUser(authHeader);
        if (caller.getUserRole() != UserRole.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Solo el Administrador puede quitar países"));
        }
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        String existing = target.getCountryCode() != null ? target.getCountryCode() : "";
        java.util.List<String> countries = new java.util.ArrayList<>(
            java.util.Arrays.asList(existing.split(",")));
        countries.removeIf(c -> c.trim().equalsIgnoreCase(code));
        target.setCountryCode(String.join(",", countries));
        userRepository.save(target);
        return ResponseEntity.ok(Map.of("message", "País " + code.toUpperCase() + " removido"));
    }

    @GetMapping("/farmers")
    public ResponseEntity<?> getFarmers(@RequestHeader("Authorization") String authHeader) {
        User caller = resolveUser(authHeader);
        if (!isManagerRole(caller)) {
            return ResponseEntity.status(403).body(Map.of("message", "Acceso denegado"));
        }
        // ADMIN ve todos los usuarios menos él mismo
        if (caller.getUserRole() == UserRole.ADMIN) {
            return ResponseEntity.ok(userRepository.findAll().stream()
                    .filter(u -> !u.getId().equals(caller.getId()))
                    .map(this::toDto).toList());
        }
        // LIDER ve farmers y otros líderes (menos él mismo)
        return ResponseEntity.ok(userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(caller.getId()))
                .filter(u -> u.getRole().equals(UserRole.FARMER_MASS.name())
                          || u.getRole().equals(UserRole.LIDER.name()))
                .map(this::toDto).toList());
    }

    private boolean isManagerRole(User user) {
        return user.getUserRole() == UserRole.LIDER || user.getUserRole() == UserRole.ADMIN;
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
        map.put("farmerCode",  u.getFarmerCode() != null ? u.getFarmerCode() : "");
        map.put("nickname",    u.getNickname() != null ? u.getNickname() : "");
        map.put("countryCode", u.getCountryCode() != null ? u.getCountryCode() : "");
        map.put("avatarUrl",   u.getAvatarUrl() != null ? u.getAvatarUrl() : "");
        return map;
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "jpg";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    public record NicknameRequest(String nickname) {}
    public record CountryRequest(String countryCode) {}
}
