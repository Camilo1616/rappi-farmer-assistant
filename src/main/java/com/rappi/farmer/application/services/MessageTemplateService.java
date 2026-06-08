package com.rappi.farmer.application.services;

import com.rappi.farmer.application.dtos.MessageTemplateDto;
import com.rappi.farmer.infrastructure.persistence.entity.MessageTemplateEntity;
import com.rappi.farmer.infrastructure.persistence.repository.MessageTemplateJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageTemplateService {

    private final MessageTemplateJpaRepository repository;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seedDefaultTemplates() {
        if (repository.count() > 0) return;

        crearDefault("Onboarding sin venta",
                "Hola {store_name}! 👋 Te escribimos del equipo de Rappi. " +
                "Notamos que aún no has recibido tu primera orden. " +
                "¿Hay algo en lo que podamos ayudarte para activar tu restaurante? " +
                "Estamos aquí para acompañarte en el proceso.");

        crearDefault("Aliados baja conexión",
                "Hola {store_name}! 👋 Te contactamos de Rappi. " +
                "Tu porcentaje de conexión esta semana está por debajo del 60%. " +
                "Recuerda mantener tu restaurante conectado para recibir más pedidos. " +
                "¿Podemos ayudarte a mejorar tu disponibilidad?");

        crearDefault("Riesgo Churn",
                "Hola {store_name}! 👋 Somos del equipo de Rappi y queremos saber cómo estás. " +
                "Notamos una disminución en tu actividad. " +
                "¿Has tenido algún inconveniente? Estamos aquí para resolverlo juntos.");

        crearDefault("Mensaje general",
                "Hola {store_name}! 👋 Te escribimos del equipo de Rappi. " +
                "¿Cómo está yendo todo con tu restaurante? " +
                "Cualquier duda o inconveniente, aquí estamos para ayudarte.");

        log.info("Plantillas por defecto creadas");
    }

    public List<MessageTemplateDto> getAll() {
        return repository.findAll().stream()
                .map(e -> new MessageTemplateDto(e.getId(), e.getName(), e.getContent()))
                .collect(Collectors.toList());
    }

    @Transactional
    public MessageTemplateDto save(String name, String content) {
        if (repository.existsByName(name)) {
            MessageTemplateEntity existing = repository.findByName(name).get();
            existing.setContent(content);
            existing.setUpdatedAt(LocalDateTime.now());
            MessageTemplateEntity saved = repository.save(existing);
            return new MessageTemplateDto(saved.getId(), saved.getName(), saved.getContent());
        }
        MessageTemplateEntity entity = new MessageTemplateEntity();
        entity.setName(name);
        entity.setContent(content);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        MessageTemplateEntity saved = repository.save(entity);
        return new MessageTemplateDto(saved.getId(), saved.getName(), saved.getContent());
    }

    @Transactional
    public void update(Long id, String name, String content) {
        repository.findById(id).ifPresent(e -> {
            e.setName(name);
            e.setContent(content);
            e.setUpdatedAt(LocalDateTime.now());
            repository.save(e);
        });
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private void crearDefault(String name, String content) {
        MessageTemplateEntity e = new MessageTemplateEntity();
        e.setName(name);
        e.setContent(content);
        e.setCreatedAt(LocalDateTime.now());
        e.setUpdatedAt(LocalDateTime.now());
        repository.save(e);
    }
}
