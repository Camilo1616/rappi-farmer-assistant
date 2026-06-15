package com.rappi.farmer.presentation.api;

import com.rappi.farmer.domain.repositories.StoreRepository;
import com.rappi.farmer.domain.repositories.UserRepository;
import com.rappi.farmer.infrastructure.persistence.entity.*;
import com.rappi.farmer.infrastructure.persistence.repository.*;
import com.rappi.farmer.infrastructure.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequestMapping("/api/bases")
@RequiredArgsConstructor
public class BaseController {

    private final BaseJpaRepository baseRepo;
    private final BaseAssignmentJpaRepository assignmentRepo;
    private final BaseStoreJpaRepository baseStoreRepo;
    private final NotificationJpaRepository notifRepo;
    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final ManagementJpaRepository managementJpaRepo;
    private final JwtService jwtService;

    // SSE emitters por userId
    private static final Map<Long, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    // ── Líder: crear base y asignar farmers ──────────────────────────────────

    @PostMapping
    @Transactional
    public ResponseEntity<?> createBase(@Valid @RequestBody CreateBaseRequest req,
            @RequestHeader("Authorization") String authHeader) {
        Long liderId = resolveUserId(authHeader);

        BaseEntity base = new BaseEntity(null, req.title(), req.type(), req.message(), liderId, LocalDateTime.now());
        BaseEntity saved = baseRepo.save(base);

        // IDs seleccionados manualmente por el líder (si aplica)
        Set<Long> selectedIds = (req.storeIds() != null && !req.storeIds().isEmpty())
                ? new java.util.HashSet<>(req.storeIds()) : null;

        for (Long farmerId : req.farmerIds()) {
            // Tiendas del farmer filtradas por tipo; si el líder ajustó la selección, filtrar por esos IDs
            int days = req.activeDays() != null ? req.activeDays() : 7;
            List<com.rappi.farmer.domain.entities.Store> farmerStores = switch (req.type()) {
                case "CHURN"      -> storeRepository.findChurnByFarmerIds(List.of(farmerId));
                case "ACTIVE_F7D" -> storeRepository.findActiveF7dByFarmerIds(List.of(farmerId));
                case "ACTIVE"     -> storeRepository.findActiveNoLoginByFarmerIds(List.of(farmerId), days);
                case "RETENCION"  -> storeRepository.findRetencionByFarmerIds(List.of(farmerId));
                case "AVA_8_14"   -> storeRepository.findAva8a14ByFarmerIds(List.of(farmerId));
                default           -> storeRepository.findAllActiveByFarmerIds(List.of(farmerId));
            };
            for (var store : farmerStores) {
                if (selectedIds == null || selectedIds.contains(store.getId())) {
                    baseStoreRepo.save(new BaseStoreEntity(null, saved.getId(), store.getId()));
                }
            }
            BaseAssignmentEntity assignment = new BaseAssignmentEntity(
                    null, saved.getId(), farmerId, "SIN_LEER",
                    null, null, null, LocalDateTime.now());
            assignmentRepo.save(assignment);

            // Notificar al farmer
            String farmerName = userRepository.findById(farmerId)
                    .map(u -> u.getFullName()).orElse("Farmer");
            NotificationEntity notif = new NotificationEntity(
                    null, farmerId,
                    "Nueva base asignada: " + req.title(),
                    req.message() != null ? req.message().substring(0, Math.min(120, req.message().length())) + "..." : "",
                    "BASE_ASIGNADA", saved.getId(), false, LocalDateTime.now());
            notifRepo.save(notif);

            pushNotification(farmerId, Map.of(
                    "type", "BASE_ASIGNADA",
                    "title", "Nueva base: " + req.title(),
                    "baseId", saved.getId()
            ));
        }

        log.info("Base creada: {} — {} farmers asignados", saved.getTitle(), req.farmerIds().size());
        return ResponseEntity.ok(toBaseDto(saved));
    }

    @GetMapping("/lider")
    public ResponseEntity<?> getBasesForLider(@RequestHeader("Authorization") String authHeader) {
        Long liderId = resolveUserId(authHeader);
        List<BaseEntity> bases = baseRepo.findByLiderIdOrderByCreatedAtDesc(liderId);
        return ResponseEntity.ok(bases.stream().map(this::toBaseDtoWithProgress).toList());
    }

    /** Llamado automáticamente cuando el farmer registra su primera gestión del día. */
    @PostMapping("/auto-en-proceso")
    @Transactional
    public ResponseEntity<?> autoEnProceso(@RequestHeader("Authorization") String authHeader) {
        Long farmerId = resolveUserId(authHeader);
        assignmentRepo.findByFarmerIdOrderByAssignedAtDesc(farmerId).stream()
                .filter(a -> "LEIDA".equals(a.getStatus()) || "SIN_LEER".equals(a.getStatus()))
                .findFirst()
                .ifPresent(a -> {
                    a.setStatus("EN_PROCESO");
                    if (a.getReadAt() == null) a.setReadAt(LocalDateTime.now());
                    if (a.getStartedAt() == null) a.setStartedAt(LocalDateTime.now());
                    assignmentRepo.save(a);
                    baseRepo.findById(a.getBaseId()).ifPresent(base -> {
                        Long liderId = base.getLiderId();
                        String farmerName = userRepository.findById(farmerId).map(u -> u.getFullName()).orElse("Farmer");
                        NotificationEntity notif = new NotificationEntity(null, liderId,
                                farmerName + " está gestionando: " + base.getTitle(),
                                "Estado: EN_PROCESO", "BASE_EN_PROCESO", a.getId(), false, LocalDateTime.now());
                        notifRepo.save(notif);
                        pushNotification(liderId, Map.of("type","BASE_EN_PROCESO","title", farmerName + " → " + base.getTitle(),"status","EN_PROCESO","baseId", base.getId()));
                    });
                });
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ── Farmer: ver sus bases y actualizar estado ────────────────────────────

    @GetMapping("/farmer")
    public ResponseEntity<?> getBasesForFarmer(@RequestHeader("Authorization") String authHeader) {
        Long farmerId = resolveUserId(authHeader);
        List<BaseAssignmentEntity> assignments = assignmentRepo.findByFarmerIdOrderByAssignedAtDesc(farmerId);
        return ResponseEntity.ok(assignments.stream().map(a -> {
            BaseEntity base = baseRepo.findById(a.getBaseId()).orElse(null);
            if (base == null) return null;
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("assignmentId", a.getId());
            dto.put("baseId", base.getId());
            dto.put("title", base.getTitle());
            dto.put("type", base.getType());
            dto.put("message", base.getMessage());
            dto.put("status", a.getStatus());
            dto.put("assignedAt", a.getAssignedAt());
            dto.put("readAt", a.getReadAt());
            // IDs de tiendas guardadas en la base, filtradas por las que pertenecen al farmer
            List<Long> baseStoreIds = baseStoreRepo.findByBaseId(base.getId()).stream()
                    .map(com.rappi.farmer.infrastructure.persistence.entity.BaseStoreEntity::getStoreId)
                    .toList();
            List<Map<String, Object>> stores = storeRepository.findByUserIdAndIdIn(farmerId, baseStoreIds).stream()
                    .map(s -> {
                        Map<String, Object> sm = new LinkedHashMap<>();
                        sm.put("id", s.getId());
                        sm.put("storeCode", s.getStoreCode());
                        sm.put("storeName", s.getStoreName());
                        sm.put("phoneNumber", s.getPhoneNumber());
                        sm.put("currentStatus", s.getCurrentStatus());
                        sm.put("connectionPercentage", s.getConnectionPercentage());
                        return sm;
                    }).toList();
            dto.put("stores", stores);
            return dto;
        }).filter(Objects::nonNull).toList());
    }

    @PatchMapping("/assignment/{assignmentId}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@PathVariable Long assignmentId,
            @RequestBody StatusRequest req,
            @RequestHeader("Authorization") String authHeader) {
        Long farmerId = resolveUserId(authHeader);
        BaseAssignmentEntity assignment = assignmentRepo.findById(assignmentId)
                .orElseThrow(() -> new RuntimeException("Asignación no encontrada"));

        String oldStatus = assignment.getStatus();
        assignment.setStatus(req.status());

        if ("LEIDA".equals(req.status()) && assignment.getReadAt() == null) {
            assignment.setReadAt(LocalDateTime.now());
        }
        if ("EN_PROCESO".equals(req.status()) && assignment.getStartedAt() == null) {
            assignment.setStartedAt(LocalDateTime.now());
        }
        if ("COMPLETADO".equals(req.status())) {
            assignment.setCompletedAt(LocalDateTime.now());
        }
        assignmentRepo.save(assignment);

        // Notificar al líder
        BaseEntity base = baseRepo.findById(assignment.getBaseId()).orElse(null);
        if (base != null) {
            String farmerName = userRepository.findById(farmerId).map(u -> u.getFullName()).orElse("Farmer");
            String statusLabel = switch (req.status()) {
                case "LEIDA" -> "leyó";
                case "EN_PROCESO" -> "está gestionando";
                case "COMPLETADO" -> "completó";
                default -> "actualizó";
            };
            NotificationEntity notif = new NotificationEntity(
                    null, base.getLiderId(),
                    farmerName + " " + statusLabel + " la base: " + base.getTitle(),
                    "Estado: " + req.status(),
                    "BASE_" + req.status(), assignment.getId(), false, LocalDateTime.now());
            notifRepo.save(notif);

            pushNotification(base.getLiderId(), Map.of(
                    "type", "BASE_" + req.status(),
                    "title", farmerName + " → " + base.getTitle(),
                    "status", req.status(),
                    "baseId", base.getId()
            ));
        }

        return ResponseEntity.ok(Map.of("status", req.status()));
    }

    @GetMapping("/{baseId}/progress")
    public ResponseEntity<?> getProgress(@PathVariable Long baseId,
            @RequestHeader("Authorization") String authHeader) {
        List<BaseAssignmentEntity> assignments = assignmentRepo.findByBaseId(baseId);
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("SIN_LEER",  assignments.stream().filter(a -> "SIN_LEER".equals(a.getStatus())).count());
        counts.put("LEIDA",     assignments.stream().filter(a -> "LEIDA".equals(a.getStatus())).count());
        counts.put("EN_PROCESO",assignments.stream().filter(a -> "EN_PROCESO".equals(a.getStatus())).count());
        counts.put("COMPLETADO",assignments.stream().filter(a -> "COMPLETADO".equals(a.getStatus())).count());

        List<Map<String, Object>> detail = assignments.stream().map(a -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("assignmentId", a.getId());
            row.put("farmerId", a.getFarmerId());
            row.put("farmerName", userRepository.findById(a.getFarmerId()).map(u -> u.getFullName()).orElse("—"));
            row.put("status", a.getStatus());
            row.put("readAt", a.getReadAt());
            row.put("startedAt", a.getStartedAt());
            row.put("completedAt", a.getCompletedAt());
            return row;
        }).toList();

        return ResponseEntity.ok(Map.of("counts", counts, "detail", detail));
    }

    /** Tiendas de una base con gestión del día por farmer — para vista en tiempo real del líder */
    @GetMapping("/{baseId}/stores")
    public ResponseEntity<?> getBaseStores(@PathVariable Long baseId,
            @RequestHeader("Authorization") String authHeader) {
        List<Long> storeIds = baseStoreRepo.findByBaseId(baseId).stream()
                .map(BaseStoreEntity::getStoreId).toList();

        if (storeIds.isEmpty()) return ResponseEntity.ok(List.of());

        LocalDateTime startOfDay = java.time.LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay   = startOfDay.plusDays(1);

        // Gestiones de hoy para estas tiendas
        List<ManagementEntity> todayMgts = managementJpaRepo
                .findTodayByStoreIds(storeIds, startOfDay, endOfDay);

        Map<Long, List<ManagementEntity>> mgtsByStore = todayMgts.stream()
                .collect(java.util.stream.Collectors.groupingBy(m -> m.getStore().getId()));

        List<Map<String, Object>> result = storeIds.stream().map(storeId -> {
            var storeOpt = storeRepository.findById(storeId);
            if (storeOpt.isEmpty()) return null;
            var store = storeOpt.get();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("storeId", storeId);
            row.put("storeName", store.getStoreName());
            row.put("brandId", store.getStoreCode());
            row.put("phoneNumber", store.getPhoneNumber());
            List<Map<String, Object>> mgts = mgtsByStore.getOrDefault(storeId, List.of()).stream()
                    .map(m -> {
                        Map<String, Object> md = new LinkedHashMap<>();
                        md.put("id", m.getId());
                        md.put("type", m.getManagementType());
                        md.put("result", m.getResultType());
                        md.put("comment", m.getComments());
                        md.put("farmerName", m.getUser() != null ? m.getUser().getFullName() : "—");
                        md.put("time", m.getManagementDate());
                        md.put("brandSync", m.isBrandSync());
                        return md;
                    }).toList();
            row.put("managements", mgts);
            row.put("gestionada", !mgts.isEmpty());
            return row;
        }).filter(Objects::nonNull).toList();

        return ResponseEntity.ok(result);
    }

    // ── Notificaciones ───────────────────────────────────────────────────────

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(@RequestHeader("Authorization") String authHeader) {
        Long userId = resolveUserId(authHeader);
        return ResponseEntity.ok(notifRepo.findByUserIdOrderByCreatedAtDesc(userId));
    }

    @GetMapping("/notifications/unread-count")
    public ResponseEntity<?> getUnreadCount(@RequestHeader("Authorization") String authHeader) {
        Long userId = resolveUserId(authHeader);
        return ResponseEntity.ok(Map.of("count", notifRepo.countByUserIdAndReadIsFalse(userId)));
    }

    @PostMapping("/notifications/mark-all-read")
    @Transactional
    public ResponseEntity<?> markAllRead(@RequestHeader("Authorization") String authHeader) {
        Long userId = resolveUserId(authHeader);
        notifRepo.markAllReadByUserId(userId);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // SSE — usa fetch con header Authorization (no EventSource nativo)
    @GetMapping(value = "/notifications/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamNotifications(@RequestHeader("Authorization") String authHeader) {
        Long userId = resolveUserId(authHeader);
        SseEmitter emitter = new SseEmitter(60 * 60 * 1000L);
        emitters.computeIfAbsent(userId, k -> Collections.synchronizedList(new ArrayList<>())).add(emitter);
        emitter.onCompletion(() -> removeEmitter(userId, emitter));
        emitter.onTimeout(() -> removeEmitter(userId, emitter));
        return emitter;
    }

    // ── Templates de mensajes por tipo ───────────────────────────────────────

    @GetMapping("/templates")
    public ResponseEntity<?> getTemplates() {
        return ResponseEntity.ok(List.of(
            Map.of("type","ACTIVE","label","ACTIVE",
                "template","Team! Les dejo la base ACTIVE del día.\n\nAliados que ingresaron recientemente — debemos lograr login y activación con órdenes.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}"),
            Map.of("type","CHURN","label","Churn",
                "template","Team! Les dejo la base CHURN del día.\n\nAliados que esta semana nos entran en churn — recuerden que lo ideal es buscar reconexión de por lo menos 5 minutos dentro de horario.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}"),
            Map.of("type","RETENCION","label","Prioridad Retención",
                "template","Team! Les dejo la base PRIORIDAD RETENCIÓN del día.\n\nLa prioridad está en la columna 2 — empiecen por los 'Prioridad 1'. Hay aliados con AVA MTD desde 6% hacia arriba. Recuerden: para que cuente en retención debe tener AVA del 10%.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}"),
            Map.of("type","AVA_8_14","label","AVA 8-14",
                "template","Team! Les dejo la base AVA 8-14 del día.\n\nAliados que YA LES CUENTAN PARA AVA. Miren la columna U — filtren por URGENTE!!\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}")
        ));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void pushNotification(Long userId, Map<String, Object> data) {
        List<SseEmitter> userEmitters = emitters.get(userId);
        if (userEmitters == null) return;
        List<SseEmitter> dead = new ArrayList<>();
        for (SseEmitter emitter : userEmitters) {
            try {
                emitter.send(SseEmitter.event().name("notification").data(data));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        userEmitters.removeAll(dead);
    }

    private void removeEmitter(Long userId, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(userId);
        if (list != null) list.remove(emitter);
    }

    private Long resolveUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("Token inválido");
        }
        String token = authHeader.substring(7);
        String email = jwtService.extractEmail(token);
        log.debug("resolveUserId — email extraído: {}", email);
        return userRepository.findByEmail(email)
                .map(u -> u.getId())
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + email));
    }

    private Map<String, Object> toBaseDto(BaseEntity b) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", b.getId());
        dto.put("title", b.getTitle());
        dto.put("type", b.getType());
        dto.put("message", b.getMessage());
        dto.put("createdAt", b.getCreatedAt());
        return dto;
    }

    private Map<String, Object> toBaseDtoWithProgress(BaseEntity b) {
        Map<String, Object> dto = toBaseDto(b);
        List<BaseAssignmentEntity> assignments = assignmentRepo.findByBaseId(b.getId());
        dto.put("totalFarmers", assignments.size());
        dto.put("sinLeer",    assignments.stream().filter(a -> "SIN_LEER".equals(a.getStatus())).count());
        dto.put("leida",      assignments.stream().filter(a -> "LEIDA".equals(a.getStatus())).count());
        dto.put("enProceso",  assignments.stream().filter(a -> "EN_PROCESO".equals(a.getStatus())).count());
        dto.put("completado", assignments.stream().filter(a -> "COMPLETADO".equals(a.getStatus())).count());

        List<Map<String, Object>> assignmentDtos = assignments.stream().map(a -> {
            Map<String, Object> ad = new LinkedHashMap<>();
            ad.put("id", a.getId());
            ad.put("farmerId", a.getFarmerId());
            ad.put("status", a.getStatus());
            ad.put("readAt", a.getReadAt());
            ad.put("startedAt", a.getStartedAt());
            ad.put("completedAt", a.getCompletedAt());
            ad.put("assignedAt", a.getAssignedAt());
            String farmerName = userRepository.findById(a.getFarmerId())
                    .map(u -> u.getFullName()).orElse("Farmer #" + a.getFarmerId());
            ad.put("farmerName", farmerName);
            long storeCount = baseStoreRepo.countByBaseId(b.getId());
            ad.put("storeCount", storeCount);
            return ad;
        }).toList();
        dto.put("assignments", assignmentDtos);
        return dto;
    }

    public record CreateBaseRequest(
            @NotBlank String title,
            @NotBlank String type,
            String message,
            @NotEmpty List<Long> farmerIds,
            List<Long> storeIds,
            String churnFilter,
            Integer activeDays) {}

    public record StatusRequest(String status) {}
}
