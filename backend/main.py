import asyncio
from contextlib import asynccontextmanager
from decouple import config
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pony.orm import *
from src.db import db
from src.controllers.auth_controller import router as auth_router
from src.controllers.user_controller import router as users_router
from src.controllers.activation_task_controller import router as activation_tasks_router
from src.controllers.notification_controller import router as notifications_router
from src.controllers.mandatory_tasks_controller import router as mandatory_tasks_router
from src.controllers.particular_task_controller import router as particular_tasks_router
from src.controllers.settings_controller import router as settings_router
from src.controllers.events_controller import router as events_router

db.generate_mapping(create_tables=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.loop = asyncio.get_running_loop()
    yield


# Sin redirecciones automáticas /users ↔ /users/: evitan 307/308 que, tras el proxy de
# Next en dev, pueden apuntar a otro host y el navegador quita Authorization → 401.
app = FastAPI(lifespan=lifespan, redirect_slashes=False)


def _cors_allow_origins() -> list[str]:
    """
    Orígenes explícitos: con allow_credentials=True el navegador NO acepta
    Access-Control-Allow-Origin: * en peticiones con Authorization (Bearer).
    Definí CORS_ORIGINS en .env separado por comas, ej:
    CORS_ORIGINS=https://app.tudominio.com,http://localhost:3000

    Con front y API en el mismo dominio detrás de nginx (mismo origen), el
    navegador no hace CORS en /api ni en /events; esta lista sigue siendo
    necesaria si el front vive en otro host (ej. Vercel → API en otro dominio).
    """
    raw = config("CORS_ORIGINS", default="").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(
    activation_tasks_router, prefix="/activation-tasks", tags=["activation-tasks"]
)
api_router.include_router(
    notifications_router, prefix="/notifications", tags=["notifications"]
)
api_router.include_router(mandatory_tasks_router, tags=["mandatory-tasks"])
api_router.include_router(
    particular_tasks_router, prefix="/particular-tasks", tags=["particular-tasks"]
)
api_router.include_router(settings_router, prefix="/settings", tags=["settings"])

app.include_router(api_router, prefix="/api")
# SSE fuera de /api: nginx suele proxy_pass largo para streams y cache desactivado.
app.include_router(events_router, prefix="/events", tags=["events"])