package com.rappi.farmer.presentation.api;

import com.rappi.farmer.application.services.ProfileExtrasService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileExtrasController {

    private final ProfileExtrasService service;

    @GetMapping("/performance")
    public ResponseEntity<?> performance() {
        return ResponseEntity.ok(service.getPerformance());
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body) {
        try {
            service.changePassword(body.get("currentPassword"), body.get("newPassword"));
            return ResponseEntity.ok(Map.of("message", "Contraseña actualizada"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/notes")
    public ResponseEntity<?> getNotes() {
        return ResponseEntity.ok(service.getNotes());
    }

    @PostMapping("/notes")
    public ResponseEntity<?> createNote(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(service.saveNote(body.get("content")));
    }

    @PutMapping("/notes/{id}")
    public ResponseEntity<?> updateNote(@PathVariable Long id, @RequestBody Map<String, String> body) {
        service.updateNote(id, body.get("content"));
        return ResponseEntity.ok(Map.of("message", "ok"));
    }

    @DeleteMapping("/notes/{id}")
    public ResponseEntity<?> deleteNote(@PathVariable Long id) {
        service.deleteNote(id);
        return ResponseEntity.ok(Map.of("message", "ok"));
    }
}
