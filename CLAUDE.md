# Rappi Assistant

## Visión general

Este proyecto se llamaba **Rappi Farmer Assistant** (gestión de cartera de restaurantes para Account Managers). Ese alcance quedó cerrado y el equipo se movió a un área nueva, todavía por definir en detalle. El código fue **limpiado de todo lo específico del dominio anterior** (tiendas, gestiones, priorización, dashboard, IA de recomendación, Google Calendar) y se dejó una base genérica para reconstruir sobre ella.

Próximo objetivo conocido: replicar en código un sistema hoy implementado en Google Apps Script ("Gestión AGM-IA") — una IA (LINA) gestiona tareas de onboarding/handoff de aliados y escala a un agente humano los casos que no puede resolver, actualmente registrados en un Google Sheet. Aún no está integrado a este proyecto.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Java 21, Spring Boot 3.x |
| Frontend | React + Vite |
| Base de datos | MySQL 8 |
| WhatsApp | Node.js (whatsapp-web.js), servicio separado en `whatsapp-service/` |
| Build | Maven (backend), npm/Vite (frontend) |

## Arquitectura

Arquitectura en capas (Clean Architecture adaptada a Spring Boot), paquete raíz `com.rappi.assistant`:

```
presentation/     → Controladores REST
application/      → Casos de uso / Services / DTOs
domain/           → Entidades, enums, interfaces de repositorio, excepciones
infrastructure/   → Repositorios JPA, seguridad, config, Selenium (WhatsApp)
```

## Qué quedó (base genérica)

- **Auth JWT** con validación de correo `@rappi.com` obligatoria, registro con PIN por email (Brevo), login/logout, heartbeat de actividad.
- **Usuarios**: roles `ADMIN` y `USER` únicamente (se quitó la jerarquía farmer/líder/país/countryCode). `ProfileController` permite promover/degradar roles, editar nickname/avatar y cambiar contraseña.
- **WhatsApp — dejado tal cual, bloqueado**: conexión/QR/sesión (`WhatsappService` + `whatsapp-service/` Node) sigue funcionando igual que antes. El **envío masivo** ahora depende de una lista genérica de contactos (`WhatsappContactDto: {id, name, phoneNumber}`) en vez de tiendas — el backend lo soporta, pero el frontend (`WhatsappPage.jsx`) solo expone conexión + mensaje de prueba; el envío masivo está deshabilitado hasta que haya una fuente de contactos real.
- Plantillas de mensaje (`MessageTemplateService`) y notificaciones quedaron como infraestructura reusable.

## Qué se eliminó

Store/Excel import, Management (gestiones) + formularios "Palanca", Priorities/Bases (ambos sistemas legacy y nuevo), Dashboard/Reportes, AI Assistant (recomendaciones), Google Calendar/OAuth de handoff, Dashboard Líder. Todo el frontend correspondiente (páginas, componentes, servicios) también se borró.

## Convenciones de código

- **Idioma del código:** inglés (variables, métodos, clases)
- **Idioma de comentarios/documentación:** español
- **Estilo:** Google Java Style Guide, 4 espacios de indentación
- Siempre usar **DTOs** para transferencia entre capas (nunca exponer entidades JPA directamente)
- Excepciones propias en `domain/exceptions/`
- Logs con SLF4J (`@Slf4j`)
- Separación estricta de capas — los Services no acceden a repositorios de otras capas directamente
- Inyección por constructor (no `@Autowired` en campos)

## Comandos útiles

```bash
# Backend
./mvnw clean compile
./mvnw spring-boot:run

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
```

## Instrucciones para Claude

1. El dominio de negocio real todavía no está definido — no asumir que sigue siendo sobre restaurantes/farmers.
2. Antes de reconstruir un módulo, preguntar por el flujo de negocio real (no inventar reglas).
3. Respetar la separación de capas definida arriba.
4. El módulo de WhatsApp se debe tratar como "congelado" — no ampliarlo hasta que haya una fuente de datos de contactos definida; solo tocarlo si el usuario lo pide explícitamente.
5. Cuando se conecte el nuevo flujo de "Gestión AGM-IA" (LINA), pedir acceso al código real del Apps Script (Extensiones → Apps Script) antes de diseñar entidades — no adivinar el esquema del Sheet.
