from fastapi import APIRouter, Depends, HTTPException, Query
from src import schemas
from src.services.mandatory_task_services import MandatoryTaskService
from src.controllers.auth_controller import get_current_user

router = APIRouter()
service = MandatoryTaskService()


@router.get("/mandatory-tasks")
def list_mandatory_tasks(
    phase: str | None = Query(None, description="Filtrar por fase (ej: Acceso)"),
    current_user=Depends(get_current_user),
):
    try:
        return service.get_all(phase)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener tareas obligatorias")


@router.post("/mandatory-tasks", status_code=201)
def create_mandatory_task(
    payload: schemas.MandatoryTaskCreate,
    current_user=Depends(get_current_user),
):
    try:
        result = service.create(payload)
        return {"message": "Tarea creada correctamente", "success": True, "data": result}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al crear tarea.", "success": False}


@router.patch("/mandatory-tasks/{task_id}")
def update_mandatory_task(
    task_id: int,
    payload: schemas.MandatoryTaskUpdate,
    current_user=Depends(get_current_user),
):
    try:
        result = service.update(task_id, payload)
        return {"message": "Tarea actualizada correctamente", "success": True, "data": result}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al actualizar tarea.", "success": False}


@router.delete("/mandatory-tasks/{task_id}")
def delete_mandatory_task(
    task_id: int,
    current_user=Depends(get_current_user),
):
    try:
        service.delete(task_id)
        return {"message": "Tarea eliminada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al eliminar tarea.", "success": False}


@router.get("/mandatory-tasks-completion")
def get_mandatory_tasks_completion(
    email: str = Query(..., description="Email del cliente"),
    phase: str = Query("Acceso", description="Fase (ej: Acceso)"),
    current_user=Depends(get_current_user),
):
    try:
        slugs = service.get_completion(email, phase)
        return {"completed_slugs": slugs}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener completitud de tareas")


@router.post("/mandatory-tasks-complete")
def set_mandatory_task_complete(
    payload: schemas.MandatoryTaskCompleteRequest,
    current_user=Depends(get_current_user),
):
    try:
        ok = service.set_completed(payload.email, payload.task_slug, payload.completed)
        if not ok:
            return {"message": "Usuario, cliente o tarea no encontrados", "success": False}
        return {"message": "Tarea marcada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado.", "success": False}


@router.post("/assign-mandatory-task")
def assign_mandatory_task_to_client(
    payload: schemas.AssignMandatoryTaskRequest,
    current_user=Depends(get_current_user),
):
    try:
        ok = service.assign_to_client(payload.email, payload.task_slug)
        if not ok:
            return {"message": "Alumno o tarea no encontrados", "success": False}
        return {"message": "Tarea asignada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al asignar tarea.", "success": False}
