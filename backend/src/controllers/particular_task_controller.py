from fastapi import APIRouter, Depends, HTTPException, Query, Request
from src import schemas
from src.services.particular_task_services import ParticularTaskService
from src.controllers.auth_controller import get_current_user
from src.notifications_broadcast import broadcast_to_user

router = APIRouter()
service = ParticularTaskService()


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
