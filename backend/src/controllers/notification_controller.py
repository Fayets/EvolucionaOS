from fastapi import APIRouter, Depends, HTTPException, Query
from src.services.notification_services import NotificationService
from src.controllers.auth_controller import get_current_user

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
