import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from src import schemas
from src.controllers.auth_controller import get_current_user, get_staff_user
from src.models import Role
from src.services.activation_task_services import ActivationTaskService
from src.services.client_services import ClientService
from src.services.user_services import UsersService
from src.notifications_broadcast import broadcast_to_user
from src.sse_broadcast import EVENT_ACTIVATION_TASKS_CHANGED, broadcast

logger = logging.getLogger(__name__)

router = APIRouter()
user_service = UsersService()
client_service = ClientService()
activation_service = ActivationTaskService()


def _ensure_may_access_client_email(current_user, email: str) -> None:
    if getattr(current_user, "role", None) == Role.CLIENTE:
        if (email or "").strip().lower() != (current_user.email or "").strip().lower():
            raise HTTPException(status_code=403, detail="No autorizado")

# Transiciones que el cliente puede aplicar solo (sin aprobación del director)
_CLIENT_SELF_PHASE_MOVES = {("platforms", "Acceso")}


def _client_may_set_phase_directly(old_phase: str | None, new_phase: str) -> bool:
    old = old_phase or ""
    return (old, new_phase) in _CLIENT_SELF_PHASE_MOVES


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


@router.get("/me/client-phase")
def get_my_client_phase(current_user=Depends(get_current_user)):
    if current_user.role != Role.CLIENTE:
        raise HTTPException(status_code=403, detail="Solo para clientes")
    try:
        phase = client_service.get_or_create_client_phase(current_user.id)
        return {"phase": phase}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener la fase")


@router.post("/phase-advance-request")
def request_phase_advance(
    payload: schemas.PhaseAdvanceRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    if current_user.role != Role.CLIENTE:
        return {"message": "Solo los alumnos pueden solicitar avance de fase", "success": False}
    if payload.email.strip().lower() != current_user.email.strip().lower():
        return {"message": "No autorizado", "success": False}
    try:
        ok, msg = activation_service.create_phase_advance_request(
            payload.email, payload.next_phase
        )
        if not ok:
            return {"message": msg, "success": False}
        loop = request.app.state.loop
        loop.call_soon_threadsafe(lambda: broadcast(EVENT_ACTIVATION_TASKS_CHANGED))
        return {"message": msg, "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al solicitar avance.", "success": False}


@router.put("/client-phase")
def set_client_phase(
    payload: schemas.ClientPhaseRequest,
    current_user=Depends(get_current_user),
):
    VALID_PHASES = {
        "initial", "platforms", "tasks", "onboarding", "done",
        "Acceso", "Onboarding", "Base de Negocios",
        "Marketing", "Proceso de Ventas", "Optimizar",
        # aliases legacy para no romper datos existentes
        "Bases de Negocio", "Creación de Funnels", "Marketing y Comunicación",
        "Ecosistema de Contenido", "Procesos de Venta", "Producto y Funnel Interno",
    }
    if payload.phase not in VALID_PHASES:
        return {"message": "Fase no válida", "success": False}
    try:
        old_phase = client_service.get_client_phase_by_email(payload.email)
        if current_user.role == Role.CLIENTE:
            if payload.email.strip().lower() != current_user.email.strip().lower():
                return {"message": "No autorizado", "success": False}
            if old_phase != payload.phase and not _client_may_set_phase_directly(
                old_phase, payload.phase
            ):
                return {
                    "message": (
                        "Para pasar de fase completá las tareas y enviá la solicitud; "
                        "tu director debe aprobar el avance."
                    ),
                    "success": False,
                }

        ok = client_service.set_client_phase_by_email(payload.email, payload.phase)
        if not ok:
            return {"message": "Usuario no encontrado", "success": False}

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
        _ensure_may_access_client_email(current_user, email)
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
        _ensure_may_access_client_email(current_user, payload.email)
        client_service.set_onboarding_responses(payload.email, payload.responses)
        return {"message": "Onboarding guardado correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al guardar onboarding.", "success": False}


@router.get("/mandatory-deliverables")
def get_mandatory_deliverables(
    email: str = Query(..., description="Email del cliente"),
    current_user=Depends(get_current_user),
):
    _ensure_may_access_client_email(current_user, email)
    try:
        data = client_service.get_mandatory_task_deliverables(email)
        return {"deliverables": data}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener entregables")


@router.put("/mandatory-deliverables")
def submit_mandatory_deliverable(
    payload: schemas.MandatoryDeliverableSubmitRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    _ensure_may_access_client_email(current_user, payload.email)
    try:
        client_service.set_mandatory_task_deliverable(
            payload.email,
            payload.task_slug,
            payload.task_label,
            payload.note,
            payload.link,
        )
        try:
            activation_service.create_deliverable_submitted_task(
                payload.email,
                payload.task_label,
                payload.task_slug,
            )
        except Exception:
            logger.exception("create_deliverable_submitted_task")
        loop = request.app.state.loop
        loop.call_soon_threadsafe(lambda: broadcast(EVENT_ACTIVATION_TASKS_CHANGED))
        return {"message": "Entregable guardado correctamente", "success": True}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al guardar el entregable")


@router.put("/mandatory-deliverables/director-feedback")
def submit_deliverable_director_feedback(
    payload: schemas.MandatoryDeliverableDirectorFeedbackRequest,
    request: Request,
    _staff=Depends(get_staff_user),
):
    try:
        client_service.set_mandatory_task_deliverable_director_feedback(
            str(payload.student_email),
            payload.task_slug,
            payload.director_note,
            payload.director_link,
        )
        em = str(payload.student_email).strip()
        loop = request.app.state.loop
        loop.call_soon_threadsafe(
            lambda e=em: broadcast_to_user(e, {"type": "new_notification"})
        )
        return {"message": "Corrección enviada al alumno", "success": True}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Error al enviar la corrección al alumno"
        )


@router.get("/clients")
def get_clients_list(current_user=Depends(get_current_user)):
    try:
        return {"clients": client_service.get_clients_list()}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener clientes")
