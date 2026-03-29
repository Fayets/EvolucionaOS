import json
import logging
from fastapi import HTTPException
from pony.orm import db_session
from src import models, schemas

logger = logging.getLogger(__name__)


def _parse_deliverable_links(raw: str | None) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x).strip() for x in data if str(x).strip()]
        return []
    except (json.JSONDecodeError, TypeError):
        return []


def _dump_deliverable_links(urls: list[str] | None) -> str | None:
    if not urls:
        return None
    cleaned = [u.strip() for u in urls if u and str(u).strip()]
    if not cleaned:
        return None
    return json.dumps(cleaned, ensure_ascii=False)


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
                        "deliverable_links": _parse_deliverable_links(
                            getattr(t, "deliverable_links", None)
                        ),
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
                for t in list(models.MandatoryTask.select()):
                    if t.phase == data.phase and t.order is not None and t.order > max_order:
                        max_order = t.order
                create_kw: dict = {
                    "slug": slug,
                    "label": data.label,
                    "link_url": (data.link_url or "").strip(),
                    "phase": data.phase,
                    "order": max_order + 1,
                }
                dumped_dl = _dump_deliverable_links(data.deliverable_links)
                if dumped_dl is not None:
                    create_kw["deliverable_links"] = dumped_dl
                task = models.MandatoryTask(**create_kw)
                task.flush()
                return {
                    "id": task.id,
                    "slug": task.slug,
                    "label": task.label,
                    "link_url": task.link_url or "",
                    "deliverable_links": _parse_deliverable_links(task.deliverable_links),
                    "order": task.order,
                    "phase": task.phase,
                }
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("MandatoryTaskService.create")
                err_s = str(e).lower()
                detail = "Error al crear tarea obligatoria"
                if "deliverable_links" in err_s or (
                    "column" in err_s and "does not exist" in err_s
                ) or "no such column" in err_s:
                    detail = (
                        "La base no tiene la columna de entregables. "
                        "Ejecutá: cd backend && python3 ../scripts/add_mandatory_task_deliverable_links.py"
                    )
                raise HTTPException(status_code=500, detail=detail) from e

    def update(self, task_id: int, data: schemas.MandatoryTaskUpdate) -> dict:
        with db_session:
            try:
                task = models.MandatoryTask.get(id=task_id)
                if not task:
                    raise HTTPException(status_code=404, detail="Tarea no encontrada")
                if data.label is not None:
                    task.label = data.label
                if data.link_url is not None:
                    task.link_url = (data.link_url or "").strip()
                if data.deliverable_links is not None:
                    dumped = _dump_deliverable_links(data.deliverable_links)
                    task.deliverable_links = dumped if dumped is not None else ""
                return {
                    "id": task.id,
                    "slug": task.slug,
                    "label": task.label,
                    "link_url": task.link_url or "",
                    "deliverable_links": _parse_deliverable_links(task.deliverable_links),
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
