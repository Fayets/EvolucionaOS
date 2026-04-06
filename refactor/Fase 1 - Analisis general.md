# Fase 1 — Análisis general (EvolucionaOS)

Documento técnico y crítico del repositorio **frontend** (Next.js) y **backend** (FastAPI), basado en el código vigente en el workspace.

---

## 1. Stack tecnológico completo

### Frontend

| Capa | Tecnología |
|------|------------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19** |
| Lenguaje | **TypeScript** (strict habilitado en `tsconfig`, pero el build **ignora errores de TypeScript** — ver sección 6) |
| Estilos | **Tailwind CSS 4** (`@import 'tailwindcss'`), **tw-animate-css**, tokens en `app/globals.css` |
| Componentes | **shadcn/ui** (estilo *new-york*, Radix primitives masivos en `components/ui/`) |
| Formularios / validación | **react-hook-form**, **@hookform/resolvers**, **zod** |
| Iconos | **lucide-react** |
| Fuentes | **Geist** / **Geist Mono** (`next/font/google`) |
| PDF (dependencia) | **jspdf** |
| Gráficos (dependencia) | **recharts** |
| Analytics | **@vercel/analytics** |
| Temas | **next-themes** presente en dependencias y `theme-provider.tsx`; el layout raíz **no** envuelve la app con `ThemeProvider` (la UI efectiva es oscura fija) |
| Empaquetado / tooling | PostCSS, **shadcn** CLI en devDependencies; lockfiles **npm y pnpm** coexisten (`package-lock.json` y `pnpm-lock.yaml`) — señal de falta de convención única |

### Backend

| Capa | Tecnología |
|------|------------|
| API | **FastAPI** |
| Servidor ASGI | **uvicorn** |
| ORM | **Pony ORM** |
| Base de datos | **PostgreSQL** vía `psycopg2-binary` (configuración por `python-decouple`) |
| Auth | **JWT** (`python-jose`), **bcrypt** para hashes, **OAuth2PasswordBearer** |
| Validación / DTOs | **Pydantic v2** |
| Tiempo real | **Server-Sent Events (SSE)** en rutas bajo `/events` |
| CORS | `CORSMiddleware` con orígenes configurables (`CORS_ORIGINS`) |

### Arquitectura de despliegue / integración

- **Mismo origen deseado**: el cliente llama a `/api/...` y `/events/...` en el host del front.
- **Next.js Route Handler** (`frontend/app/api/[[...path]]/route.ts`) hace **proxy inverso** al backend (`BACKEND_URL`), reenviando cuerpo y cabeceras seleccionadas, para evitar redirecciones que pierdan `Authorization`.
- **Rewrites** en `next.config.mjs` envían `/events/:path*` al backend (SSE fuera del prefijo `/api` por comentarios de nginx/caché).
- **FastAPI** monta el API REST bajo `/api` y SSE bajo `/events`; `redirect_slashes=False` está justificado explícitamente por el mismo problema de proxy y Bearer.

**Crítica:** La arquitectura es coherente para desarrollo y un reverse proxy en producción, pero duplica responsabilidades (rewrites + route handler) que hay que documentar y mantener alineadas con nginx/Vercel.

---

## 2. Estructura del frontend

### Carpetas relevantes

- **`frontend/app/`**: App Router mínimo — `layout.tsx`, `page.tsx` (SPA lógica), `globals.css`, `manifest.ts`, ruta catch-all **`api/[[...path]]`** (proxy).
- **`frontend/components/`**:
  - **`ui/`**: biblioteca shadcn (muy amplia; muchos componentes posiblemente sin uso).
  - **`client/`**: flujo del cliente (fases, formularios, tareas).
  - **`director/`**: panel del director (cola, registro, usuarios, fases, settings, etc.).
  - Raíz: `login-form`, `app-header`, `app-notifications`, `client-sidebar`, `theme-provider`.
- **`frontend/lib/`**: utilidades (`api.ts`, `utils.ts`), dominio compartido (`phases.ts`, `phase-advance.ts`), contextos (`app-context.tsx`, `registered-users-context.tsx`), hooks SSE.
- **`frontend/hooks/`**: `use-toast`, `use-mobile` (y duplicado parcial con `components/ui/use-toast` típico de shadcn).

### Componentes y “layouts”

- **No hay rutas anidadas** (`app/client/...`, `app/director/...`): toda la aplicación autenticada vive en **`app/page.tsx`**.
- **Layout visual del director**: `DirectorView` + `DirectorSidebar` + `ClientLayoutLogo` (reutiliza piezas del cliente).
- **Layout del cliente**: implícito por fase (`ClientView` renderiza un componente u otro según `clientPhase`).
- **`AppHeader`**: definido en `components/app-header.tsx` pero **sin referencias** en el resto del frontend (código muerto o pendiente de integrar); las vistas usan otras cabeceras o layouts embebidos.

**Crítica:** La estructura de carpetas por rol (`client/` vs `director/`) es clara, pero el **App Router está infrautilizado**: no hay segmentación por URL, lo que limita enlaces profundos, historial del navegador y carga diferida por ruta.

---

## 3. Vistas y navegación

### Modelo actual: SPA con estado local

1. **`AppProvider`** (`lib/app-context.tsx`) concentra sesión: login, rol (`client` | `director` mapeado desde backend), fase del cliente, email, JWT.
2. **`page.tsx`**: si no hay sesión → `LoginForm`; si hay → `DirectorView` o `ClientView` según `userRole`.
3. **Cliente**: navegación **por máquina de estados** `clientPhase` (strings como `initial`, `platforms`, `Onboarding`, `done`, más fases de programa definidas en `CLIENT_PHASES`). No hay `useRouter` para cambiar de “pantalla” salvo efectos laterales que actualicen fase vía API + `setClientPhase`.
4. **Director**: navegación por **`useState<DirectorViewId>`** en `DirectorView` + sidebar; tampoco hay rutas URL.

**Crítica:**

- **URL = siempre `/`**: imposible compartir “vista de usuario X” o “fase Y” con un link; refresh conserva estado solo vía `sessionStorage`, no vía ruta.
- **Sensibilidad a mayúsculas / strings mágicos**: p. ej. `client-view.tsx` usa `"Onboarding"` mientras otras fases usan convenciones distintas (`"initial"`, nombres de programa). Cualquier divergencia front/back rompe el flujo silenciosamente.
- **Sincronización fase cliente**: `AppProvider` reconsulta `/users/me/client-phase` al hidratar; es positivo, pero la lógica de transición está repartida entre componentes y `phase-advance.ts`.

---

## 4. Comunicación con el backend

### Mecanismos

| Mecanismo | Uso |
|-----------|-----|
| **REST** | `fetch` / `apiFetch` hacia rutas bajo `/api/...` (mismo origen) |
| **Login / register** | `application/x-www-form-urlencoded` en login (OAuth2 password flow típico); registro con JSON en algunos formularios |
| **Auth** | JWT en `Authorization: Bearer`; persistencia en `sessionStorage` (`evoluciona_token` + objeto `evoluciona_session`) |
| **401 global** | `apiFetch` dispara evento `EVOLUCIONA_AUTH_UNAUTHORIZED` → `logout` en contexto |
| **SSE** | `EventSource` a `/events/notifications?email=...` (cliente) y `/events/activation-tasks` (director); reconexión con timeout 3s |
| **Actualizaciones complementarias** | Polling en `AppNotifications` (intervalos ~8s) además de SSE |

### Endpoints (muestra representativa del grep y controladores)

- **Auth**: `/api/auth/login`, `/api/auth/register`, verificación de token, etc.
- **Usuarios / cliente**: `/api/users/...` (fase, email, entregables, detalle, borrado, avance de fase).
- **Tareas**: `/api/mandatory-tasks`, `/api/mandatory-tasks-completion`, `/api/particular-tasks/...`, `/api/activation-tasks/...`.
- **Notificaciones**: `/api/notifications/...`.
- **Settings**: `/api/settings/...`.
- **Eventos**: `/events/activation-tasks`, `/events/notifications`.

### Estado en el cliente

- **Global**: React Context (`AppProvider`, `RegisteredUsersProvider` para el director).
- **Local**: abundante `useState` / `useEffect` por componente.
- **No hay** TanStack Query / SWR / Redux: invalidación manual tras mutaciones y eventos custom del DOM (`ACTIVATION_TASKS_CHANGED`, `CLIENT_NOTIFICATIONS_CHANGED`).

**Crítica:**

- **Patrón híbrido SSE + polling + eventos globales en `window`**: funciona, pero es difícil de testear y de razonar; riesgo de condiciones de carrera y de fugas si los listeners no se limpian bien.
- **Tipado de API**: respuestas tipadas ad hoc por componente; no hay capa única de contratos TS generados desde OpenAPI/Pydantic.
- **Seguridad SSE**: las notificaciones por `EventSource` usan query `email`; sin cookie de sesión en ese canal, la superficie depende de que el stream no filtre datos de terceros (revisar en `events_controller` y broadcast que el aislamiento por email sea estricto).

---

## 5. Patrones de UI/UX actuales

### Lo que se observa

- **Estética**: tema oscuro dominante (`layout` fuerza `bg-black`, nebulosas en `page.tsx`), alineado con “dashboard” moderno.
- **Design system**: tokens CSS shadcn (oklch) en `:root` y `.dark`; en la práctica mucha UI del director usa **estilos inline** y colores hex/zinc en lugar de variables semánticas (`DirectorSidebar`).
- **Componentes**: botones, dropdowns, diálogos Radix/shadcn donde corresponde; formularios con inputs consistentes en partes del flujo.
- **Feedback**: notificaciones en campana (director: conteo tareas nuevas; cliente: lista); loading local en formularios.
- **PWA / móvil**: `manifest.ts`, iconos y comentarios en metadata sobre iOS; `appleWebApp` configurado.
- **Accesibilidad**: Radix mejora foco y ARIA en primitivas; mezclar inline styles y contrastes custom requiere verificación manual (no sustituye auditoría).

### Inconsistencias UX

- **`lang="en"`** en `<html>` mientras la UI y errores están en español.
- **Tema claro/oscuro**: variables `.dark` existen pero el cuerpo no alterna clase `dark` de forma centralizada en el layout analizado — riesgo de componentes que asumen `bg-background` en un contexto siempre negro.
- **Inventario UI grande**: decenas de paquetes `@radix-ui/*` y componentes generados; sin tree-shaking agresivo o uso real, suman complejidad y tiempo de build.

---

## 6. Legibilidad, escalabilidad y mantenibilidad — problemas y riesgos

### Críticos o altos

1. **`typescript.ignoreBuildErrors: true`** en `next.config.mjs`: anula la protección del tipado en CI/producción; la deuda se acumula sin fricción.
2. **Aplicación monopágina en una sola ruta**: escalar features (más roles, más vistas) empuja a un solo `page.tsx` y contextos cada vez más grandes.
3. **Fases del cliente como strings libres**: duplicación de conocimiento con backend (`phases.ts`, `LEGACY_TO_CANONICAL`, valores en BD); falta un contrato único versionado.
4. **Dos lockfiles** (npm + pnpm): reproducibilidad de builds y “fuente de verdad” de dependencias ambigua.
5. **Eventos globales en `window`**: acoplamiento oculto entre hooks SSE y componentes; refactor o SSR híbrido se complica.

### Medios

6. **Servicios en backend** bien separados (`*_services.py`) vs **controladores** delgados en parte; Pony ORM con `db.generate_mapping(create_tables=True)` en `main.py`: conveniente en dev, peligroso si se espera migraciones explícitas (Alembic/Flyway no presentes).
7. **Roles backend** (`SISTEMAS`, `MARKETING`, …) vs **rol UI** binario (`director` | `client`): si en el futuro otros roles internos usan el front, el mapeo actual es insuficiente.
8. **`package.json` name `"my-project"`**: señal de plantilla sin alinear con el producto (documentación y tooling).
9. **Componentes shadcn no usados**: ruido en el repo y en reviews; conviene inventariar o generar bajo demanda.
10. **`AppHeader` sin uso**: refuerza la idea de UI fragmentada o features a medias.

### Positivos (para balance)

- Comentarios útiles en `main.py`, `api.ts`, proxy y CORS explican decisiones reales (no solo “código muerto”).
- `apiFetch` centraliza Bearer y 401; `bearerToken` opcional mitiga carreras tras login.
- Separación clara **controllers / services / schemas** en el backend.
- SSE con keepalive y headers para proxies es una decisión madura para infraestructura típica.

---

## Resumen ejecutivo

EvolucionaOS es un **producto full-stack con Next.js 16 + React 19** en el front y **FastAPI + Pony + PostgreSQL** en el back, integrados por **proxy same-origin** y **SSE** para refrescos en tiempo casi real. El front prioriza **una sola página** con **contexto de sesión** y **navegación por estado**, no por rutas; el back sigue un **patrón capas clásico** con JWT.

Las mayores deudas para escalar son: **tipado efectivo** (no ignorar TS en build), **rutas y modelo de navegación**, **contrato de fases/roles único** entre capas, y **simplificar o formalizar** la capa de datos en tiempo real (menos `window.dispatchEvent`, más una librería de estado servidor o al menos módulos de eventos tipados).

---

*Generado como parte de “Fase 1 — Análisis general” del proyecto EvolucionaOS.*
