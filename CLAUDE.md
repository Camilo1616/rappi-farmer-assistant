# Rappi Farmer Assistant

## Visión general

Aplicación desktop para automatizar la gestión diaria de una cartera de 400–500 restaurantes en Rappi. El usuario es Account Manager (Cristian) y necesita registrar gestiones, enviar mensajes masivos por WhatsApp Web, analizar prioridades y exportar reportes.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje | Java 24 |
| Framework | Spring Boot 3.x |
| UI | JavaFX |
| Base de datos | MySQL 8 |
| Automatización web | Selenium 4 |
| Lectura de Excel | Apache POI |
| Build | Maven |

## Arquitectura

Arquitectura en capas (Clean Architecture adaptada a Spring Boot):

```
presentation/     → Controladores JavaFX (FXML + Controllers)
application/      → Casos de uso / Services
domain/           → Entidades, Value Objects, interfaces de repositorio
infrastructure/   → Repositorios JPA, Selenium, POI, configuración
```

## Estructura de carpetas

```
rappi-farmer-assistant/
├── src/
│   └── main/
│       ├── java/com/rappi/farmer/
│       │   ├── RappiFarmerApplication.java
│       │   ├── presentation/
│       │   │   ├── controllers/
│       │   │   └── javafx/
│       │   ├── application/
│       │   │   ├── services/
│       │   │   └── dtos/
│       │   ├── domain/
│       │   │   ├── entities/
│       │   │   ├── enums/
│       │   │   └── repositories/
│       │   └── infrastructure/
│       │       ├── persistence/
│       │       ├── selenium/
│       │       ├── excel/
│       │       └── config/
│       └── resources/
│           ├── application.properties
│           ├── fxml/
│           └── css/
└── pom.xml
```

## Base de datos

### Tablas principales

- **stores** — Tiendas con info de onboarding, ventas, conexión Rappi Aliados
- **daily_management** — Gestiones diarias (tipo, resultado, comentario, hora)
- **whatsapp_messages** — Log de mensajes enviados, estado (enviado/error/inválido)
- **priorities** — Prioridad por tienda (alta/media/baja) con motivo
- **excel_uploads** — Historial de archivos Excel cargados
- **metrics** — Métricas diarias agregadas por usuario
- **users** — Usuarios del sistema

### Enums importantes

**TipoGestion:** `WHATSAPP`, `LLAMADA`, `SAC`, `SEGUIMIENTO`, `ACTIVACION`

**ResultadoGestion:** `EFECTIVA`, `NO_CONTACTO`, `NO_RESPONDE`, `PROBLEMA_TECNICO`, `REQUIERE_SEGUIMIENTO`

**NivelPrioridad:** `ALTA`, `MEDIA`, `BAJA`

## Metas diarias

| Métrica | Meta |
|---|---|
| Gestiones efectivas | Mínimo 15 |
| No contactos | 25–40 |
| WhatsApp masivo | Máximo 40 tiendas/día |

## Reglas de priorización automática

Una tienda se marca como **PRIORIDAD ALTA** si cumple alguna de estas condiciones:
- Sin ventas registradas
- Día 7 de onboarding sin activación
- Conexión Rappi Aliados < 60% (se revisa entre día 8 y 14)
- Más de 3 días sin contacto
- Riesgo de churn detectado

## WhatsApp masivo (Selenium)

- Máximo **40 tiendas** por envío
- Tiempo aleatorio entre mensajes: **10–25 segundos**
- Variables dinámicas: `{store_name}`, `{owner_name}`
- Registrar estado por mensaje: `ENVIADO`, `ERROR`, `NUMERO_INVALIDO`
- Usar WhatsApp Web en Chrome con ChromeDriver

## Convenciones de código

- **Idioma del código:** inglés (variables, métodos, clases)
- **Idioma de comentarios/documentación:** español
- **Estilo:** Google Java Style Guide
- **Indentación:** 4 espacios
- **Nomenclatura:**
    - Clases: `PascalCase`
    - Métodos/variables: `camelCase`
    - Constantes: `UPPER_SNAKE_CASE`
    - Tablas BD: `snake_case`
- Siempre usar **DTOs** para transferencia entre capas (nunca exponer entidades JPA directamente)
- Siempre manejar excepciones con clases de excepción propias en `domain/exceptions/`
- Logs con SLF4J (`@Slf4j`)

## Buenas prácticas obligatorias

- Separación estricta de capas — los Services no acceden a repositorios de otras capas directamente
- Inyección por constructor (no `@Autowired` en campos)
- Validaciones en la capa `application` con Bean Validation
- Transacciones con `@Transactional` solo en la capa `application`
- Nunca lógica de negocio en Controllers JavaFX
- Selenium corre en hilo separado (no en el hilo de JavaFX)
- Configuración sensible solo en `application.properties` o variables de entorno

## Comandos útiles

```bash
# Compilar
mvn clean compile

# Ejecutar tests
mvn test

# Empaquetar
mvn clean package -DskipTests

# Ejecutar aplicación
mvn javafx:run
```

## Contexto de negocio (para Claude)

- El usuario gestiona **400–500 restaurantes** como Account Manager en Rappi
- El flujo diario empieza cargando un Excel con el estado de la cartera
- Cada tienda tiene un ciclo de vida: onboarding → activación → seguimiento → churn
- Los primeros **8 días** son críticos: la tienda debe empezar a vender
- Entre **día 8 y 14** se revisa la conexión de Rappi Aliados (meta > 60%)
- Las gestiones se tipifican también en Zoho CRM (externo, no integrado en este MVP)
- Este proyecto se construye **paso a paso**, explicando cada decisión

## Estado del proyecto

- [ ] Estructura inicial y configuración Maven
- [ ] Entidades y repositorios JPA
- [ ] Carga de Excel con Apache POI
- [ ] Módulo de gestión diaria
- [ ] Dashboard JavaFX
- [ ] WhatsApp masivo con Selenium
- [ ] Priorización automática
- [ ] Exportación de reportes Excel
- [ ] Tests unitarios e integración

## Instrucciones para Claude

1. Siempre explicar **por qué** se toma cada decisión de arquitectura
2. Construir **incrementalmente** — un módulo a la vez, funcional antes de pasar al siguiente
3. Cuando generes código, incluir también los **tests unitarios** correspondientes
4. Si algo puede hacerse de dos formas válidas, presentar opciones con pros/contras
5. Respetar siempre la separación de capas definida arriba
6. Antes de refactorizar código existente, preguntar si hay contexto adicional