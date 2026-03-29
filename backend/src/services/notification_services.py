import logging
from fastapi import HTTPException
from pony.orm import db_session
from src import models

logger = logging.getLogger(__name__)


class NotificationService:

    def notify_client_task_completed(self, task_id: int) -> str | None:
        """Crea una notificación para el cliente. Devuelve el email del cliente para emitir SSE, o None."""
        with db_session:
            try:
                task = models.ActivationTask.get(id=task_id)
                if not task or not task.completed:
                    return None
                user = models.User.get(email=task.client_email)
                if not user:
                    return None
                if task.requested_next_phase:
                    title = "Fase aprobada"
                    body = (
                        f'Tu director aprobó el avance a la fase "{task.requested_next_phase}".'
                    )
                else:
                    title = "Tarea completada"
                    body = f"El administrador completó tu solicitud: {task.description}"
                models.Notification(
                    user=user,
                    title=title,
                    body=body,
                )
                return task.client_email
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("notify_client_task_completed: %s", e)
                return None

    def get_notifications_by_email(self, email: str) -> list[dict]:
        """Lista notificaciones del usuario (por email), más recientes primero."""
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return []
                rows = list(user.notifications)
                rows.sort(key=lambda n: n.created_at or "", reverse=True)
                rows = rows[:50]
                return [
                    {
                        "id": n.id,
                        "title": n.title,
                        "body": n.body,
                        "read_at": n.read_at.isoformat() if n.read_at else None,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                    }
                    for n in rows
                ]
            except HTTPException:
                raise
            except Exception:
                return []
