from fastapi import APIRouter, Depends, HTTPException, Request
from src import schemas
from src.services.activation_task_services import ActivationTaskService
from src.services.notification_services import NotificationService
from src.controllers.auth_controller import get_current_user
from src.sse_broadcast import broadcast, EVENT_ACTIVATION_TASKS_CHANGED
from src.notifications_broadcast import broadcast_to_user

router = APIRouter()
service = ActivationTaskService()
notification_service = NotificationService()


@router.post("/skool-click")
def create_skool_click(
    req: schemas.SkoolClickRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    try:
        service.create_skool_click_task(req.email)
        loop = request.app.state.loop
        loop.call_soon_threadsafe(lambda: broadcast(EVENT_ACTIVATION_TASKS_CHANGED))
        return {"message": "Tarea de Skool creada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al crear tarea.", "success": False}


@router.post("/discord-click")
def create_discord_click(
    req: schemas.DiscordClickRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    try:
        service.create_discord_click_task(req.email)
        loop = request.app.state.loop
        loop.call_soon_threadsafe(lambda: broadcast(EVENT_ACTIVATION_TASKS_CHANGED))
        return {"message": "Tarea de Discord creada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al crear tarea.", "success": False}


@router.get("/all")
def get_activation_tasks_list(current_user=Depends(get_current_user)):
    try:
        tasks = service.get_activation_tasks_list()
        return {"tasks": tasks}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener tareas de activación")


@router.get("/new-count")
def get_new_activation_tasks_count(current_user=Depends(get_current_user)):
    try:
        count = service.get_new_activation_tasks_count()
        return {"count": count}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener conteo de tareas")


@router.delete("/completed")
def delete_completed_tasks(
    request: Request,
    current_user=Depends(get_current_user),
):
    try:
        count = service.delete_completed_tasks()
        loop = request.app.state.loop
        loop.call_soon_threadsafe(lambda: broadcast(EVENT_ACTIVATION_TASKS_CHANGED))
        return {"message": f"{count} tarea(s) eliminada(s)", "success": True, "deleted": count}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al eliminar tareas.", "success": False}


@router.patch("/{task_id}")
def update_activation_task(
    task_id: int,
    payload: schemas.UpdateActivationTaskRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    try:
        ok = service.update_activation_task(
            task_id,
            completed=payload.completed,
            is_new=payload.is_new,
        )
        if not ok:
            return {"message": "Tarea no encontrada", "success": False}

        client_email = None
        if payload.completed is True:
            client_email = notification_service.notify_client_task_completed(task_id)

        loop = request.app.state.loop
        loop.call_soon_threadsafe(lambda: broadcast(EVENT_ACTIVATION_TASKS_CHANGED))
        if client_email:
            loop.call_soon_threadsafe(
                lambda: broadcast_to_user(client_email, {"type": "new_notification"})
            )
        return {"message": "Tarea actualizada correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al actualizar tarea.", "success": False}
