# Fase 1 — Rediseño (adaptado al análisis general)

Este documento responde a las preguntas de rediseño a partir del análisis de **Fase 1 — Análisis general** y del código actual del frontend.

---

## 1. ¿Qué partes del frontend están más acopladas y dificultan un rediseño?

Orden aproximado de **mayor a menor fricción** para cambiar maquetas, flujos o identidad visual sin romper lógica:

| Acoplamiento | Por qué frena el rediseño |
|--------------|---------------------------|
| **`lib/app-context.tsx` + todo lo que usa `useApp()`** | Sesión, rol, fase del cliente, token y persistencia viven en un solo contexto. Cualquier pantalla nueva o layout distinto sigue dependiendo de ese “cerebro” monolítico; es difícil probar vistas aisladas o montar otro shell (sidebar/topbar) sin arrastrar el mismo estado. |
| **Máquina de fases del cliente (`clientPhase` + `ClientView` + formularios)** | La “navegación” es qué componente se monta según un string. Un rediseño tipo comunidad (varias secciones accesibles a la vez) choca con el modelo **una sola vista activa por fase**. |
| **`app/page.tsx` (atmósfera + enrutado implícito)** | Fondo nebulosa, z-index y decisión director/cliente están en la página raíz. Cambiar a un layout modular (shell fijo + área de contenido) obliga a **desarmar** esa composición o duplicar estilos. |
| **SSE + `window.dispatchEvent` + listeners en varios componentes** | `use-client-notifications-sse`, `use-activation-tasks-sse`, `app-notifications.tsx`, `phase-tasks.tsx`, `access-tasks.tsx`, `onboarding-form.tsx`, `tasks-queue.tsx` forman una **red implícita**. Cambiar dónde vive la campana o el feed implica re-cablear eventos globales. |
| **`AppNotifications` embebido en el árbol principal** | Notificaciones y polling están acopladas al flujo post-login global, no a un “módulo” de UI intercambiable. |
| **`DirectorView` con `useState` de vista + `RegisteredUsersProvider`** | El panel del director es un mini-SPA dentro del SPA: sidebar y contenido están unidos al estado local `view`. Rediseñar como navegación por URL o por slots modulares requiere **desacoplar** ese estado de la presentación. |
| **`registered-users-list.tsx` (~800 líneas)** | UI + fetch + mutaciones + diálogos + lógica de fases/tareas en un solo archivo: cualquier cambio visual grande implica tocar la misma masa de código que la lógica de negocio. |
| **Mezcla de tokens shadcn y estilos inline (p. ej. `DirectorSidebar`)** | El rediseño no puede apoyarse solo en variables de tema; hay decisiones de color/tipo **hardcodeadas** que hay que rastrear archivo por archivo. |

**Idea clave:** lo que más duele no es “React” en sí, sino **estado global único + navegación por fase sin URL + bus de eventos en `window` + componentes gigantes**.

---

## 2. ¿Qué componentes deberían separarse o refactorizarse?

### Prioridad alta (impacto directo en mantenibilidad y rediseño)

1. **`components/director/registered-users-list.tsx`**  
   - Separar en: contenedor de datos (hooks que llaman a `apiFetch`), tabla/lista presentacional, panel de detalle de usuario, modales de acción, y utilidades de mapeo de API.  
   - Objetivo: poder cambiar layout (cards, tabs, drawer) sin tocar fetches.

2. **`lib/app-context.tsx`**  
   - Partir en capas conceptuales (aunque al inicio sigan en archivos cercanos): **AuthSession** (token, login/logout, 401), **ClientProgress** (fase, sync con servidor), quizá **UserProfile** (email, rol).  
   - Objetivo: el shell “tipo Skool” no necesita conocer la fase del cliente entera si solo muestra el avatar y el menú.

3. **`components/app-notifications.tsx` + hooks SSE**  
   - Extraer un módulo “realtime” (p. ej. `lib/realtime/` con suscripciones tipadas o un pequeño store) que exponga `useActivationTaskBadge()` / `useClientNotifications()` en lugar de eventos en `window`.  
   - Objetivo: mover la campana al topbar modular sin propagar `CustomEvent`.

4. **`components/client/phase-tasks.tsx` y `access-tasks.tsx`**  
   - Separar lista de tareas, estado de carga/empty, y llamadas API; unificar el patrón de “refresco por SSE/focus” en un hook compartido.

5. **`app/page.tsx`**  
   - Extraer `DashboardAtmosphere` y el wrapper de contenido a componentes de **layout** (p. ej. `layouts/marketing-shell.tsx` vs `layouts/app-shell.tsx`) para poder sustituir el fondo y la estructura sin tocar la lógica de `AppContent`.

### Prioridad media

6. **`DirectorView` + `DirectorSidebar`** — Definir una interfaz de “slots” o `children` para el área principal; idealmente alineada con rutas más adelante.  
7. **`ClientView`** — Tabla de enrutado fase → vista como configuración declarativa (`const PHASE_VIEWS = { ... }`) en lugar de cadena de `if`.  
8. **`login-form.tsx`** — Presentación vs llamada de login (y tests del flujo OAuth2 form).  
9. **`AppHeader` (hoy sin uso)** — Integrarlo o eliminarlo; si el rediseño incluye barra superior fija, decide si es la fuente única de verdad o se reescribe.

### Prioridad baja (higiene)

10. Inventario de **`components/ui/*`** no usado para reducir ruido y tiempo de build.  
11. Unificar **`hooks/use-toast`** vs **`components/ui/use-toast`** si genera confusión.

---

## 3. ¿Qué problemas de UX ves en la estructura actual?

1. **Sin URLs significativas** — Siempre `/`: no hay enlaces directos a “usuarios”, “tarea X”, “fase Y”; el botón “atrás” del navegador no refleja el flujo mental del usuario.  
2. **Cliente en túnel de fases** — Sensación de “wizard” obligatorio; un modelo tipo comunidad (Skool) suele permitir **varias áreas** (inicio, módulos, calendario, perfil) sin bloquear el resto.  
3. **Inconsistencia de convenciones de fase** — Mezcla de `initial`, `platforms`, `"Onboarding"` con mayúscula, nombres de programa; riesgo de bugs silenciosos y de copy confuso.  
4. **Director: mini-app sin historial** — Cambiar de “Inicio” a “Usuarios” no actualiza la URL; no se puede compartir estado de pantalla con el equipo.  
5. **Doble canal de actualización (SSE + polling + focus)** — Puede generar parpadeos o datos que “saltan” sin que el usuario entienda por qué; además es difícil predecir cuándo está “al día” la UI.  
6. **`lang="en"` con UI en español** — Accesibilidad y SEO/lectores de pantalla desalineados con el idioma real.  
7. **Tema y tokens** — Parte de la UI ignora design tokens y usa estilos inline; el producto puede sentirse “patchwork” al agrandar el sistema de diseño.  
8. **Header global no unificado** — `AppHeader` no se usa; cada flujo puede resolver cabecera a su manera → sensación de producto ensamblado.

---

## 4. Si quisiera migrar a una UI modular estilo Skool, ¿qué tendría que cambiar primero?

**Skool** (y productos similares) suelen combinar: **shell estable** (topbar + nav lateral o inferior en móvil), **módulos de contenido** (home, classroom, calendario, miembros), **jerarquía clara** y **navegación por ruta**. Tu app hoy es un **solo lienzo** que cambia por estado interno.

Orden recomendado de cambios **antes** de pixel-perfect:

1. **Introducir rutas reales en Next (App Router)** — Esqueleto mínimo: `(auth)/login`, `(app)/director/...`, `(app)/client/...` con layouts anidados. El estado de “qué pestaña del director” debería poder leerse/escribirse desde la URL (`useRouter`, `searchParams` donde aplique).  
2. **Extraer un `AppShell` compartido** — Topbar (logo, usuario, notificaciones, salir) + sidebar o tabs + `<main>{children}</main>`. Ahí reubicas `AppNotifications` y el logo sin pegarlos a `page.tsx`.  
3. **Desacoplar “fase del cliente” de “página única”** — Decidir si las fases siguen siendo secuenciales o si pasan a ser **secciones** (aunque algunas sigan bloqueadas por reglas de negocio). Eso puede implicar cambios de producto, no solo de front.  
4. **Reemplazar el bus de eventos `window` por una capa de datos** — TanStack Query, SWR, o un `EventEmitter` tipado en módulo propio; idealmente invalidación por clave en lugar de `CLIENT_NOTIFICATIONS_CHANGED` disperso.  
5. **Contrato de fases y roles único** — Enum/canonical compartido (o generado desde OpenAPI) para que el nuevo menú modular no dependa de strings mágicos.  
6. **Endurecer TypeScript en build** — Quitar `ignoreBuildErrors` para que el rediseño no acumule deuda invisible.  
7. **Recién entonces** — Sistema visual modular (cards, feed, módulos), motion, y limpieza de shadcn no usado.

Sin los pasos 1–2, cualquier mock “tipo Skool” quedará **pintura sobre el mismo acoplamiento**; con 3–4 evitás que cada módulo nuevo sea otro `useEffect` escuchando el `window`.

---

## Lista priorizada de cambios

### P0 — Fundamentos (sin esto, el rediseño escala mal)

1. **Rutas y layouts en App Router** — Salir del “todo en `/`”; layouts para director y cliente.  
2. **`AppShell` + mover atmósfera/fondo fuera del decision tree de negocio** — `page.tsx` solo compone shell + outlet.  
3. **Plan para fases del cliente** — Documentar mapa fase → permisos → UI; idealmente objeto de configuración + tipos estrictos.  
4. **Eliminar o aislar `window.dispatchEvent` / listeners** — Sustituir por hooks + invalidación centralizada (o cola de eventos tipada).

### P1 — Desacople para poder rediseñar componentes

5. **Trocear `registered-users-list.tsx`** — Presentación vs datos vs acciones.  
6. **Dividir responsabilidades en `app-context` o contextos más chicos** — Auth vs progreso de cliente.  
7. **Refactor `phase-tasks` / `access-tasks` / onboarding** — Hook compartido de “sync remoto” y componentes más pequeños.  
8. **`typescript.ignoreBuildErrors: false` + corregir errores** — Calidad de refactors.

### P2 — UX y producto modular

9. **URLs compartibles** para vistas clave del director (cola, usuario, settings).  
10. **Cliente: de túnel estricto a “módulos” con gating** — Si el producto lo permite, home + secciones en lugar de una sola pantalla por fase.  
11. **`lang="es"` (o dinámico)** y revisión de metadata PWA.  
12. **Unificar cabecera** — Usar o borrar `AppHeader`; una sola barra superior en el shell.

### P3 — Higiene y performance

13. **Un solo gestor de paquetes** (npm *o* pnpm) y un lockfile.  
14. **Inventario y poda de `components/ui`**.  
15. **Contratos API** — Tipos generados desde OpenAPI o módulo `api/types` compartido.

---

*Documento vinculado a: [Fase 1 - Analisis general.md](./Fase%201%20-%20Analisis%20general.md).*
