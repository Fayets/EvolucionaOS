from fastapi import APIRouter, Depends, HTTPException, Query
from src.services.notification_services import NotificationService
from src.controllers.auth_controller import get_current_user
from src.models import Role

router = APIRouter()
service = NotificationService()


@router.get("/all")
def get_user_notifications(
    email: str = Query(..., description="Email del usuario"),
    current_user=Depends(get_current_user),
):
    try:
        notifications = service.get_notifications_by_email(email)
        return {"notifications": notifications}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener notificaciones")


@router.delete("/all")
def clear_user_notifications(
    email: str = Query(..., description="Email del usuario"),
    current_user=Depends(get_current_user),
):
    if current_user.role == Role.CLIENTE and (email or "").strip().lower() != (current_user.email or "").strip().lower():
        return {"message": "No autorizado", "success": False}
    try:
        deleted = service.clear_notifications_for_email(email)
        return {"message": "Notificaciones eliminadas", "success": True, "deleted": deleted}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error al eliminar notificaciones", "success": False}


@router.delete("/{notification_id}")
def delete_user_notification(
    notification_id: int,
    email: str = Query(..., description="Email del usuario"),
    current_user=Depends(get_current_user),
):
    if current_user.role == Role.CLIENTE and (email or "").strip().lower() != (current_user.email or "").strip().lower():
        return {"message": "No autorizado", "success": False}
    try:
        ok = service.delete_notification_by_id_for_email(email, notification_id)
        if not ok:
            return {"message": "Notificación no encontrada", "success": False}
        return {"message": "Notificación eliminada", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error al eliminar notificación", "success": False}
