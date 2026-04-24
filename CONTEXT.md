# EvolucionaOS — contexto del sistema

Documento para compartir con un asistente (p. ej. Claude) al planificar o implementar **nuevas funcionalidades**. Resume arquitectura, convenciones y puntos sensibles del código actual.

---

## Qué es el producto

**Evoluciona** es una aplicación web de **gestión de activación de clientes**: flujos por fases (onboarding, plataformas, tareas obligatorias/particulares, etc.), panel para rol **director** (equipo interno) y vista para **cliente** (alumno). Hay tareas de activación, notificaciones y actualización en tiempo casi real vía **SSE**.

---

## Estructura del repositorio

| Carpeta | Rol |
|--------|-----|
| `frontend/` | App **Next.js 16** (App Router), React 19, TypeScript, **Tailwind 4**, componentes estilo **shadcn/ui** (`components/ui/`). |
| `backend/` | API **FastAPI** + **Pony ORM** + JWT; controladores bajo `src/controllers/`, lógica en `src/services/`, Pydantic en `src/schemas.py`, entidades en `src/models.py`. |
| `docs/` | Guías internas (p. ej. `docs/pony_orm.md` — convenciones ORM y rutas). |

No hay un único `package.json` en la raíz: front y back se ejecutan por separado.

---

## Cómo se conectan front y back

1. **REST bajo `/api/*`**  
   El navegador llama a rutas del **mismo origen** que Next (`/api/...`). El **Route Handler** `frontend/app/api/[[...path]]/route.ts` hace **proxy** al backend (`BACKEND_URL`, default `http://127.0.0.1:8000`), reenviando `Authorization`, `Content-Type`, etc. Así se evitan redirecciones que rompan el header `Authorization` en dev.

2. **SSE bajo `/events/*`**  
   **No** van por el catch-all de `/api`. En `frontend/next.config.mjs` hay un **rewrite** de `/events/:path*` → `${BACKEND_URL}/events/:path*`. El backend monta el router de eventos en `/events` (fuera del prefijo `/api`) para compatibilidad con proxies/nginx en streaming.

3. **Cliente HTTP**  
   `frontend/lib/api.ts`: `apiUrl(path)` normaliza rutas a `/api/...`; `apiFetch()` inyecta `Bearer` desde `sessionStorage` o `bearerToken` explícito; en 401 con token enviado dispara el evento `EVOLUCIONA_AUTH_UNAUTHORIZED`.

---

## Autenticación y estado global (front)

- **Login**: `POST /api/auth/login` con `application/x-www-form-urlencoded` (email/password), implementado en `components/login-form.tsx`.
- **Token**: clave `evoluciona_token` en `sessionStorage`; sesión ampliada en `evoluciona_session` (JSON con rol, fase, email, token).
- **Contexto**: `frontend/lib/app-context.tsx` — `AppProvider` envuelve la app en `app/page.tsx`. Roles en UI: `UserRole = "client" | "director" | null`. El backend usa `Role` enum (`SISTEMAS`, `MARKETING`, etc.); en login se mapea **`SISTEMAS` → `"director"`** y el resto a **`"client"`**.
- **Fase del cliente**: string (`clientPhase`), alineada con servidor vía `GET /api/users/me/client-phase` cuando aplica.

---

## Punto de entrada UI

- `frontend/app/page.tsx`: si no hay sesión → `LoginForm`; si hay → fondo/atmósfera y **`DirectorView`** o **`ClientView`** según `userRole`.
- Layout único: `app/layout.tsx` (fuentes Geist, metadata PWA, etc.).

Vistas principales:

- **Cliente**: `components/client/*` — fases, plataformas, tareas obligatorias/particulares, onboarding, etc.
- **Director**: `components/director/*` — cola de tareas, usuarios, fases, settings, registro de usuarios, entregables.

Utilidades visuales: `components/space/starfield-backdrop.tsx`, `app-header.tsx`, sidebars.

---

## Backend: rutas y dominios

Montaje en `backend/main.py`:

- Todo el REST agrupado bajo **`/api`** (`redirect_slashes=False` a propósito).
- Prefijos típicos: `/api/auth`, `/api/users`, `/api/activation-tasks`, `/api/notifications`, `/api/particular-tasks`, `/api/settings`, y rutas de **mandatory-tasks** registradas **sin** subprefijo extra en el router (paths tipo `/api/mandatory-tasks` — ver controlador).
- **SSE**: `events_controller` en **`/events`** (no bajo `/api`).

CORS: orígenes explícitos desde `CORS_ORIGINS` en `.env` (coma-separados); con credenciales no se usa `*`.

---

## Modelo de datos (Pony)

Definido en `backend/src/models.py`. Entidades principales:

- **User** — email, password_hash, **Role**, relación opcional **Client**.
- **Client** — `phase`, JSON en strings (`onboarding_responses`, `mandatory_task_deliverables`), relaciones a plataformas, tareas obligatorias/particulares, activation tasks.
- **Platform**, **ClientPlatformRequest**
- **MandatoryTask**, **ClientMandatoryTask**
- **ClientParticularTask** — tareas creadas por director por fase
- **ActivationTask** — cola tipo “pedidos” de activación (puede incluir `requested_next_phase`)
- **Notification**, **Ticket**, **RegisteredUser**, **AppSetting**

Binding DB vía `python-decouple` en `backend/src/db.py` (`DB_PROVIDER`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_NAME`). `main.py` llama `db.generate_mapping(create_tables=True)` al arrancar.

Reglas de acceso a datos: ver **`docs/pony_orm.md`** (sesiones `@db_session`, no devolver entidades crudas en JSON, paginación, etc.).

---

## Tiempo real (SSE) en el front

Hooks dedicados, por ejemplo:

- `frontend/lib/use-activation-tasks-sse.ts` → `/events/activation-tasks`
- `frontend/lib/use-client-notifications-sse.ts` → `/events/notifications`

Al agregar nuevos streams, mantener el patrón **backend `/events/...`** + rewrite en Next.

---

## Variables de entorno relevantes

| Dónde | Variable | Uso |
|--------|-----------|-----|
| Frontend (build / dev) | `BACKEND_URL` | Proxy `/api` y rewrite `/events` |
| Backend | `CORS_ORIGINS` | Orígenes permitidos (credenciales) |
| Backend | `DB_*` | Pony `db.bind` |

El backend también usa `decouple` para secretos JWT y similares (revisar `.env` de ejemplo si existe en el repo).

---

## Stack resumido

- **Front**: Next 16, React 19, Tailwind 4, Radix/shadcn, lucide-react, react-hook-form + zod, recharts, jspdf, Vercel Analytics.
- **Back**: FastAPI, Pony ORM, psycopg2 (según provider), jose (JWT), bcrypt.

---

## Consejos al implementar una feature nueva

1. **API**: añadir router/servicio/schema en backend bajo **`/api`**, serializar a dict/listas JSON (no entidades Pony crudas).
2. **Front**: preferir `apiFetch` desde `lib/api.ts` para rutas autenticadas; respetar el prefijo `/api` que ya aplica `apiUrl`.
3. **Roles**: decidir si el endpoint es solo director, solo cliente o ambos; alinear con `get_current_user` y roles en `models.Role`.
4. **SSE**: si la UI debe refrescar sola, valorar evento en `src/sse_broadcast` / routers de `events` siguiendo los existentes.
5. **Convenciones ORM**: seguir `docs/pony_orm.md`.

---

*Última revisión coherente con el código a abril de 2026. Actualizar este archivo cuando cambie arquitectura o convenciones importantes.*
