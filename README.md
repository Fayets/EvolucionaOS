# EvolucionaOS

Plataforma web para acompañar clientes en un **programa por fases** (acceso, plataformas, tareas obligatorias y particulares, onboarding, cierre). Dos roles principales: **director/staff** (gestión, tareas, cola de activación) y **cliente** (avance, formularios, notificaciones in-app).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind, shadcn/ui |
| Backend | Python, FastAPI, Uvicorn, PonyORM (síncrono) |
| Datos | PostgreSQL (p. ej. Neon u otro host) |
| Tiempo real | SSE (`/events/...`) para clientes y actualización de tareas de activación |

---

## Estructura del repo

```
EvolucionaOS/
├── frontend/     # Next.js: UI, proxy `/api` → backend, rewrites `/events`
├── backend/      # FastAPI: REST bajo `/api`, SSE bajo `/events`
└── README.md
```

---

## Cómo correr en local

1. **Backend** (desde `backend/`):

   ```bash
   uvicorn main:app --reload
   ```

   Puerto habitual **8000**. Rutas REST: `http://127.0.0.1:8000/api/...`. SSE: `http://127.0.0.1:8000/events/...`.

2. **Frontend** (desde `frontend/`):

   ```bash
   npm install
   npm run dev
   ```

   Puerto **3000**. Las peticiones del navegador van a rutas **relativas** `/api/...` y `/events/...` (proxy/rewrite hacia el backend; ver `app/api/[[...path]]/route.ts` y `next.config.mjs` / `BACKEND_URL`).

3. **Variables del backend** (`.env`, vía `python-decouple`): al menos `SECRET` (JWT) y `DB_*` — detalle en `backend/src/db.py`. Opcional: `CORS_ORIGINS` (orígenes separados por coma).

---

## Deploy (resumen)

- **Mismo origen (recomendado):** Nginx (o similar) sirve el front y hace `proxy_pass` de `/api/` y `/events/` al backend. Menos fricción CORS.
- **Front y API en hosts distintos:** configurar `CORS_ORIGINS` en el backend con el dominio real del front. Con `Authorization: Bearer` no se puede usar `Access-Control-Allow-Origin: *` junto a credenciales de forma segura; el proyecto ya usa lista explícita.
- **SSE:** en el proxy, desactivar buffering, `Cache-Control: no-cache`, timeouts largos.
- **Proceso único:** el estado de listeners SSE vive **en memoria**; varios workers o reinicios sin sticky sessions implican perder suscripciones hasta que no migres a Redis/pub-sub u otro bus.

PonyORM arranca con `create_tables=True`: útil en entornos nuevos, **no sustituye** un sistema de migraciones versionadas para evolucionar el esquema en producción.

---

## Evaluación de calidad del sistema

**Puntuación: 6,5 / 10**

| Dimensión | Comentario breve |
|-----------|------------------|
| **Arquitectura** | Separación front/back clara; proxy Next evita perder headers de auth. SSE simple y adecuado para poca concurrencia. |
| **Seguridad base** | JWT, CORS razonado, roles en backend. Falta revisar de forma sistemática autorización por recurso (quién puede actuar sobre qué email/fase). |
| **Operación** | README y comentarios en código ayudan al deploy; sin healthchecks/métricas/trazas documentadas en repo. |
| **Mantenibilidad** | Servicios y controladores separados; algo de SQL defensivo por compatibilidad de nombres de tablas. |
| **Pruebas y CI** | No hay batería visible de tests automatizados (unit/integration/e2e) en el código del producto: es el mayor freno a subir nota. |
| **Datos** | PostgreSQL es sólido; Pony sin migraciones formales aumenta riesgo en cambios de esquema. |
| **Producto** | Stack moderno (Next 16, React 19), UI coherente con shadcn; PDF de onboarding en cliente (jsPDF). |

La nota refleja un **producto entregable y desplegable** con deuda típica de equipo pequeño: prioridad en features y documentación de ops, menos en verificación automática y escalado horizontal de tiempo real.

---

## Qué se puede mejorar (priorizado)

1. **Tests automatizados:** pytest en FastAPI (auth, reglas de fase, tareas); en front, al menos tests de hooks/utilidades críticas o e2e ligero (Playwright) en flujos login + cliente.
2. **Migraciones de base de datos:** Alembic u otra herramienta, o migración gradual a SQLAlchemy 2 + Alembic si Pony se vuelve límite.
3. **SSE / real-time a escala:** Redis + pub/sub o servicio gestionado si pasás a múltiples instancias del API.
4. **Observabilidad:** logs estructurados, correlación de request id, Sentry/OpenTelemetry opcional.
5. **Validación y contratos:** OpenAPI ya lo genera FastAPI; se puede exportar tipos al front (`openapi-typescript`) para alinear DTOs.
6. **Hardening:** rate limiting en login, revisión de endpoints que aceptan `email` en query/body (evitar IDOR entre clientes), política de secretos y rotación de JWT.
7. **CI:** lint + tests en cada PR; build de Next en pipeline.

---

## Qué no hace falta mejorar “por defecto” (o conviene no forzar sin motivo)

- **No** reescribir el backend en otro lenguaje solo por moda: el cuello de botella real suele ser producto y datos, no Python.
- **No** introducir microservicios mientras un monolito FastAPI + una DB cumplen carga y equipo.
- **No** sustituir SSE por WebSockets si el modelo es notificaciones puntuales y pocos usuarios concurrentes: añade complejidad sin beneficio claro.
- **No** exigir cobertura del 100 % antes de iterar el negocio: conviene **umbral mínimo** en rutas críticas (auth, permisos, pagos si los hubiera), no perfección abstracta.
- **No** asumir que “sin tests” implica que el sistema “no sirve”: muchos sistemas en producción arrancan así; el riesgo es **coste de regresión** al crecer el equipo o el tráfico.

*(“Qué no se puede mejorar” en sentido absoluto no aplica a software: casi todo es mejorable con tiempo y presupuesto. Lo anterior son **decisiones razonables de no invertir** hasta que el contexto lo pida.)*

---

## Scripts útiles

| Ubicación | Comando | Descripción |
|-----------|---------|-------------|
| `frontend/` | `npm run dev` | Desarrollo |
| `frontend/` | `npm run build` | Build producción |
| `frontend/` | `npm run lint` | ESLint |
| `backend/` | `uvicorn main:app --reload` | API en desarrollo |

---

*Documento pensado para desarrolladores y para asistentes (p. ej. IA) al planear deploy, refactors o priorización de deuda técnica.*
