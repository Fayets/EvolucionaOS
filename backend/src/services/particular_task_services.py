import logging
from fastapi import HTTPException
from pony.orm import db_session
from src import models

logger = logging.getLogger(__name__)


class ParticularTaskService:

    def create(self, email: str, phase: str, label: str, link_url: str | None = None) -> dict | None:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return None
                client = models.Client.get(user=user)
                if not client:
                    return None
                url = (link_url or "").strip()
                task = models.ClientParticularTask(
                    client=client,
                    phase=phase,
                    label=label.strip(),
                    link_url=url or "",
                )
                task.flush()
                models.Notification(
                    user=user,
                    title="Nueva tarea asignada",
                    body=f"Tenés una nueva tarea: {task.label}",
                )
                return {
                    "id": task.id,
                    "phase": task.phase,
                    "label": task.label,
                    "link_url": task.link_url or "",
                    "completed": task.completed,
                }
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al crear tarea particular")

    def get_by_client(self, email: str, phase: str) -> list[dict]:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return []
                client = models.Client.get(user=user)
                if not client:
                    return []
                out = []
                for t in client.particular_tasks:
                    if t.phase != phase:
                        continue
                    out.append({
                        "id": t.id,
                        "phase": t.phase,
                        "label": t.label,
                        "link_url": t.link_url or "",
                        "completed": t.completed,
                    })
                out.sort(key=lambda x: x["id"])
                return out
            except HTTPException:
                raise
            except Exception:
                return []

    def set_completed(self, email: str, task_id: int, completed: bool) -> bool:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return False
                client = models.Client.get(user=user)
                if not client:
                    return False
                task = models.ClientParticularTask.get(id=task_id, client=client)
                if not task:
                    return False
                task.completed = completed
                if completed:
                    from datetime import datetime as dt
                    task.completed_at = dt.utcnow()
                else:
                    task.completed_at = None
                return True
            except HTTPException:
                raise
            except Exception:
                return False

    def delete_task(self, email: str, task_id: int) -> bool:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return False
                client = models.Client.get(user=user)
                if not client:
                    return False
                task = models.ClientParticularTask.get(id=task_id, client=client)
                if not task:
                    return False
                task.delete()
                return True
            except HTTPException:
                raise
            except Exception:
                return False
