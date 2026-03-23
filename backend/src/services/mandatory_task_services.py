import logging
from fastapi import HTTPException
from pony.orm import db_session
from src import models, schemas

logger = logging.getLogger(__name__)


def _slug_from_label(label: str) -> str:
    return (
        label.lower()
        .replace(" ", "_")
        .replace("ó", "o")
        .replace("í", "i")
        .replace("á", "a")
        .replace("é", "e")
        .replace("ú", "u")
        .replace("ñ", "n")
    )


class MandatoryTaskService:

    def get_all(self, phase: str | None = None) -> list[dict]:
        with db_session:
            try:
                all_tasks = list(models.MandatoryTask.select())
                if phase:
                    tasks = [t for t in all_tasks if t.phase == phase]
                else:
                    tasks = all_tasks
                tasks.sort(key=lambda t: (t.phase or "", t.order if t.order is not None else 0, t.id))
                return [
                    {
                        "id": t.id,
                        "slug": t.slug,
                        "label": t.label,
                        "link_url": t.link_url or "",
                        "order": t.order,
                        "phase": t.phase,
                    }
                    for t in tasks
                ]
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al obtener tareas obligatorias")

    def create(self, data: schemas.MandatoryTaskCreate) -> dict:
        with db_session:
            try:
                slug = data.slug or _slug_from_label(data.label)
                base = slug
                n = 0
                while models.MandatoryTask.get(slug=slug) is not None:
                    n += 1
                    slug = f"{base}_{n}"
                max_order = 0
                for t in models.MandatoryTask.select(lambda t: t.phase == data.phase):
                    if t.order is not None and t.order > max_order:
                        max_order = t.order
                task = models.MandatoryTask(
                    slug=slug,
                    label=data.label,
                    link_url=data.link_url or None,
                    phase=data.phase,
                    order=max_order + 1,
                )
                task.flush()
                return {
                    "id": task.id,
                    "slug": task.slug,
                    "label": task.label,
                    "link_url": task.link_url or "",
                    "order": task.order,
                    "phase": task.phase,
                }
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al crear tarea obligatoria")

    def update(self, task_id: int, data: schemas.MandatoryTaskUpdate) -> dict:
        with db_session:
            try:
                task = models.MandatoryTask.get(id=task_id)
                if not task:
                    raise HTTPException(status_code=404, detail="Tarea no encontrada")
                if data.label is not None:
                    task.label = data.label
                if data.link_url is not None:
                    task.link_url = data.link_url or None
                return {
                    "id": task.id,
                    "slug": task.slug,
                    "label": task.label,
                    "link_url": task.link_url or "",
                    "order": task.order,
                    "phase": task.phase,
                }
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al actualizar tarea obligatoria")

    def delete(self, task_id: int) -> dict:
        with db_session:
            try:
                task = models.MandatoryTask.get(id=task_id)
                if not task:
                    raise HTTPException(status_code=404, detail="Tarea no encontrada")
                for ct in list(task.client_tasks):
                    ct.delete()
                task.delete()
                return {"message": "Tarea eliminada correctamente"}
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al eliminar tarea: {e!s}")

    def get_completion(self, email: str, phase: str) -> list[str]:
        """Devuelve slugs de tareas obligatorias completadas por el cliente en la fase dada."""
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return []
                client = models.Client.get(user=user)
                if not client:
                    return []
                slugs = []
                for ct in client.mandatory_tasks:
                    if ct.mandatory_task.phase == phase and ct.completed:
                        slugs.append(ct.mandatory_task.slug)
                return slugs
            except HTTPException:
                raise
            except Exception:
                return []

    def set_completed(self, email: str, task_slug: str, completed: bool) -> bool:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return False
                client = models.Client.get(user=user)
                if not client:
                    return False
                task = models.MandatoryTask.get(slug=task_slug)
                if not task:
                    return False
                ct = models.ClientMandatoryTask.get(client=client, mandatory_task=task)
                if ct:
                    ct.completed = completed
                    if completed:
                        from datetime import datetime as dt
                        ct.completed_at = dt.utcnow()
                    return True
                if not completed:
                    return True
                models.ClientMandatoryTask(client=client, mandatory_task=task, completed=True)
                return True
            except HTTPException:
                raise
            except Exception:
                return False

    def assign_to_client(self, email: str, task_slug: str) -> bool:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return False
                client = models.Client.get(user=user)
                if not client:
                    return False
                task = models.MandatoryTask.get(slug=task_slug)
                if not task:
                    return False
                existing = models.ClientMandatoryTask.get(client=client, mandatory_task=task)
                if existing:
                    return True
                models.ClientMandatoryTask(client=client, mandatory_task=task, completed=False)
                return True
            except HTTPException:
                raise
            except Exception:
                return False
