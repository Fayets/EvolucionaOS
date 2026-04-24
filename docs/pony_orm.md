# Pony ORM Guidelines

Siempre usar Pony ORM para acceso a datos.

Imports base:
from pony.orm import *

Las entidades se definen así:

class User(db.Entity):
    id = PrimaryKey(int, auto=True)
    name = Required(str)

Usar @db_session en servicios.

Nunca usar raw SQL salvo necesidad extrema.

Siempre guiate de este link que es la documentacion oficial.

https://docs.ponyorm.org/toc.html

Definición de entidades

Las entidades deben definirse así:

class User(db.Entity):
    id = PrimaryKey(int, auto=True)
    name = Required(str)

Buenas prácticas:

Usar Required() para campos obligatorios.
Usar Optional() para campos opcionales.
Usar Set() para relaciones.
Usar cascade_delete=True cuando corresponda.
Usar nombres claros y consistentes.
Uso de sesiones

Toda lógica que acceda a la base debe usar:

@db_session

Nunca acceder a entidades fuera de una sesión.

Queries (Python 3.12+ / 3.13)

Evitar:

select(u for u in User)

Preferir:

User.select()
User.select(role="CLIENTE")
Ordenamiento

Siempre usar atributos de entidad:

User.select().order_by(desc(User.created_at))

Evitar lambdas dentro de select().

Paginación

Siempre paginar listados grandes:

query = User.select().order_by(desc(User.created_at))
users = query.page(page, count)
Serialización

Nunca devolver entidades Pony directamente.

Siempre mapear a dict:

return {
    "id": user.id,
    "name": user.name
}
Arquitectura de Rutas Backend
TODAS las rutas REST deben estar bajo /api

El backend está montado así:

api_router = APIRouter(prefix="/api")

Endpoints correctos:

/api/auth/login
/api/users
/api/mandatory-tasks
/api/activation-tasks
/api/settings
/api/notifications

Nunca crear endpoints REST fuera de /api.

SSE vive fuera de /api

Los eventos en tiempo real viven en:

/events/*

Esto es intencional porque NGINX usa configuración especial:

streaming activo
buffering off
timeouts distintos

Nunca mover SSE dentro de /api.

Redirects y Slash

FastAPI está configurado con:

FastAPI(redirect_slashes=False)

Por lo tanto:

No depender de redirecciones automáticas.
Aceptar rutas con y sin slash.

Ejemplo:

@router.get("")
@router.get("/", include_in_schema=False)
Autenticación
OAuth2PasswordBearer usa tokenUrl="/api/auth/login".
El frontend envía Bearer manualmente.
No usar cookies implícitas.

Un 401 dispara logout global en el frontend.

Frontend Calls

El frontend corre en el mismo dominio.

Siempre usar rutas relativas:

fetch("/api/users")
new EventSource("/events/notifications")

Nunca usar:

http://127.0.0.1:8000
https://evoluciona.cloud/api
process.env.NEXT_PUBLIC_API_URL
Proxy Interno Next.js

Existe un handler:

app/api/[[...path]]/route.ts

Este proxy:

recibe /api/*
llama al backend interno
sigue redirects en servidor
evita perder Authorization

Nunca eliminar ni reemplazar este proxy con rewrites.

NGINX Routing

NGINX está configurado así:

/api → backend
/events → backend streaming
/ → frontend

Nunca crear endpoints backend fuera de /api o /events.

Uvicorn en modo proxy

El backend corre con:

--proxy-headers
--forwarded-allow-ips="*"

Esto permite detectar correctamente:

HTTPS real
Host real
IP cliente

Nunca quitar estas flags.

Performance
Siempre usar paginación.
Evitar queries completas innecesarias.
Preferir Entity.select().
Usar order_by con atributos.
Deploy Flow

Producción se actualiza con:

git fetch
git reset --hard origin/master
restart backend
rebuild frontend
reload nginx

No hay hot reload en producción.