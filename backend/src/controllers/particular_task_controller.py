import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from src import schemas
from src.controllers.auth_controller import get_current_user, get_staff_user
from src.notifications_broadcast import broadcast_to_user
from src.services.activation_task_services import ActivationTaskService
from src.services.particular_task_services import ParticularTaskService
from src.sse_broadcast import EVENT_ACTIVATION_TASKS_CHANGED, broadcast

logger = logging.getLogger(__name__)

router = APIRouter()
service = ParticularTaskService()
activation_service = ActivationTaskService()


@router.post("/register", status_code=201)
def create_particular_task(
    payload: schemas.CreateParticularTaskRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    try:
        task = service.create(
            payload.email, payload.phase, payload.label, payload.link_url
        )
        if not task:
            return {"message": "Alumno no encontrado", "success": False}

        loop = request.app.state.loop
        loop.call_soon_threadsafe(
            lambda: broadcast_to_user(payload.email, {"type": "new_notification"})
        )
        return {"message": "Tarea creada correctamente", "success": True, "data": task}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al crear tarea.", "success": False}


@router.get("/all")
def get_particular_tasks(
    email: str = Query(..., description="Email del alumno"),
    phase: str = Query(..., description="Fase (ej: Acceso)"),
    current_user=Depends(get_current_user),
):
    try:
        tasks = service.get_by_client(email, phase)
        return {"tasks": tasks}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener tareas particulares")


@router.put("/{task_id}/deliverable")
def submit_particular_deliverable(
    task_id: int,
    payload: schemas.ParticularDeliverableSubmitRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    try:
        updated = service.submit_deliverable(
            str(payload.email),
            task_id,
            payload.note,
            payload.link,
        )
        try:
            activation_service.create_deliverable_submitted_task(
                str(payload.email),
                str(updated.get("label") or ""),
                f"particular:{task_id}",
            )
        except Exception:
            logger.exception("create_deliverable_submitted_task particular")
        loop = request.app.state.loop
        loop.call_soon_threadsafe(lambda: broadcast(EVENT_ACTIVATION_TASKS_CHANGED))
        return {"message": "Entregable guardado correctamente", "success": True}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al guardar el entregable")


@router.put("/{task_id}/deliverable/director-feedback")
def submit_particular_deliverable_director_feedback(
    task_id: int,
    payload: schemas.ParticularDeliverableDirectorFeedbackRequest,
    request: Request,
    _staff=Depends(get_staff_user),
):
    try:
        service.set_deliverable_director_feedback(
            str(payload.student_email),
            task_id,
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


@router.patch("/{task_id}")
def set_particular_task_complete(
    task_id: int,
    payload: schemas.ParticularTaskCompleteRequest,
    current_user=Depends(get_current_user),
):
    try:
        ok = service.set_completed(payload.email, task_id, payload.completed)
        if not ok:
            return {"message": "Tarea o alumno no encontrados", "success": False}
        return {"message": "Tarea actualizada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al actualizar tarea.", "success": False}


@router.delete("/{task_id}")
def delete_particular_task(
    task_id: int,
    email: str = Query(..., description="Email del alumno"),
    current_user=Depends(get_current_user),
):
    try:
        ok = service.delete_task(email, task_id)
        if not ok:
            return {"message": "Tarea o alumno no encontrados", "success": False}
        return {"message": "Notificacion eliminada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al eliminar notificacion.", "success": False}
