from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from src import schemas
from src.models import Role
from src.services.user_services import UsersService
from src.services.client_services import ClientService
from src.services.activation_task_services import ActivationTaskService
from src.controllers.auth_controller import get_current_user
from src.sse_broadcast import broadcast, EVENT_ACTIVATION_TASKS_CHANGED

router = APIRouter()
user_service = UsersService()
client_service = ClientService()
activation_service = ActivationTaskService()


@router.delete("/by-email")
def delete_user_by_email(
    email: str = Query(..., description="Email del usuario a eliminar"),
    current_user=Depends(get_current_user),
):
    try:
        ok = user_service.delete_user_by_email(email)
        if not ok:
            return {"message": "Usuario no encontrado", "success": False}
        return {"message": "Usuario eliminado correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al eliminar usuario.", "success": False}


@router.get("/detail")
def get_user_detail(
    email: str = Query(..., description="Email del usuario"),
    current_user=Depends(get_current_user),
):
    try:
        return user_service.get_user_detail_by_email(email)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener el usuario")


@router.get("")
@router.get("/", include_in_schema=False)
def get_users(
    current_user=Depends(get_current_user),
    page: int = Query(1, ge=1, description="Número de página"),
    count: int = Query(10, ge=1, le=100, description="Número de usuarios por página"),
    sort: Optional[str] = Query(None, description="Ordenar por campo (e.g., 'email')"),
    order: Optional[str] = Query("asc", regex="^(asc|desc)$", description="Orden asc o desc"),
    role: Optional[Role] = Query(None, description="Filtrar por rol"),
):
    try:
        return user_service.get_users(page, count, sort, order, role)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener usuarios")


@router.put("/email")
def update_email(
    payload: schemas.UpdateEmailRequest,
    current_user=Depends(get_current_user),
):
    try:
        client_service.update_client_initial_data(
            payload.old_email, payload.new_email, payload.phone
        )
        return {"message": "Email actualizado correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al actualizar email.", "success": False}


@router.put("/client-phase")
def set_client_phase(
    payload: schemas.ClientPhaseRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    VALID_PHASES = {
        "initial", "platforms", "tasks", "onboarding", "done",
        "Acceso", "Onboarding", "Bases de Negocio",
        "Creación de Funnels", "Marketing y Comunicación",
        "Ecosistema de Contenido", "Procesos de Venta",
        "Producto y Funnel Interno",
    }
    if payload.phase not in VALID_PHASES:
        return {"message": "Fase no válida", "success": False}
    try:
        old_phase = client_service.get_client_phase_by_email(payload.email)
        ok = client_service.set_client_phase_by_email(payload.email, payload.phase)
        if not ok:
            return {"message": "Usuario no encontrado", "success": False}

        if current_user.role == Role.CLIENTE and old_phase and old_phase != payload.phase:
            activation_service.create_phase_completed_task(payload.email, old_phase)
            loop = request.app.state.loop
            loop.call_soon_threadsafe(lambda: broadcast(EVENT_ACTIVATION_TASKS_CHANGED))

        return {"message": "Fase actualizada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al actualizar fase.", "success": False}


@router.get("/onboarding")
def get_onboarding(
    email: str = Query(..., description="Email del cliente"),
    current_user=Depends(get_current_user),
):
    try:
        data = client_service.get_onboarding_responses(email)
        return {"responses": data or {}}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener onboarding")


@router.put("/onboarding")
def submit_onboarding(
    payload: schemas.OnboardingSubmitRequest,
    current_user=Depends(get_current_user),
):
    try:
        client_service.set_onboarding_responses(payload.email, payload.responses)
        return {"message": "Onboarding guardado correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al guardar onboarding.", "success": False}


@router.get("/clients")
def get_clients_list(current_user=Depends(get_current_user)):
    try:
        return {"clients": client_service.get_clients_list()}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener clientes")
