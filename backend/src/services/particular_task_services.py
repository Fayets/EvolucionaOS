import json
import logging
from datetime import datetime

from fastapi import HTTPException
from pony.orm import db_session
from src import models
from src.services.client_services import _normalize_deliverable_entry, _parse_json

logger = logging.getLogger(__name__)


def _public_deliverable(task: models.ClientParticularTask) -> dict | None:
    raw = getattr(task, "deliverable_json", None) or ""
    if not str(raw).strip():
        return None
    parsed = _parse_json(raw)
    if not isinstance(parsed, dict):
        return None
    merged = {**parsed, "label": task.label}
    return _normalize_deliverable_entry(merged)


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
                    "deliverable": _public_deliverable(task),
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
                        "deliverable": _public_deliverable(t),
                    })
                out.sort(key=lambda x: x["id"])
                return out
            except HTTPException:
                raise
            except Exception:
                return []

    def submit_deliverable(
        self, email: str, task_id: int, note: str | None, link: str | None
    ) -> dict:
        n = (note or "").strip()
        u = (link or "").strip()
        if not n and not u:
            raise HTTPException(
                status_code=400,
                detail="Agregá un comentario o un enlace al entregable",
            )
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                client = models.Client.get(user=user)
                if not client:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                task = models.ClientParticularTask.get(id=task_id, client=client)
                if not task:
                    raise HTTPException(status_code=404, detail="Tarea no encontrada")
                raw = getattr(task, "deliverable_json", None) or ""
                prev = _parse_json(raw) if str(raw).strip() else None
                if not isinstance(prev, dict):
                    prev = {}
                normalized = _normalize_deliverable_entry({**prev, "label": task.label})
                history = list(normalized.get("history") or [])
                now_iso = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
                history.append(
                    {
                        "note": n,
                        "link": u,
                        "submitted_at": now_iso,
                        "director_note": None,
                        "director_link": None,
                        "corrected_at": None,
                    }
                )
                blob = {
                    "label": task.label,
                    "note": n,
                    "link": u,
                    "submitted_at": now_iso,
                    "director_note": None,
                    "director_link": None,
                    "corrected_at": None,
                    "history": history,
                }
                task.deliverable_json = json.dumps(blob, ensure_ascii=False)
                return _normalize_deliverable_entry(blob)
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(
                    status_code=500, detail="Error al guardar el entregable"
                )

    def set_deliverable_director_feedback(
        self,
        student_email: str,
        task_id: int,
        director_note: str | None,
        director_link: str | None,
    ) -> None:
        dn = (director_note or "").strip()
        dl = (director_link or "").strip()
        if not dn and not dl:
            raise HTTPException(
                status_code=400,
                detail="Agregá un comentario o un enlace para la corrección",
            )
        with db_session:
            try:
                user = models.User.get(email=student_email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                client = models.Client.get(user=user)
                if not client:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                task = models.ClientParticularTask.get(id=task_id, client=client)
                if not task:
                    raise HTTPException(status_code=404, detail="Tarea no encontrada")
                raw = getattr(task, "deliverable_json", None) or ""
                existing = _parse_json(raw)
                if not isinstance(existing, dict):
                    raise HTTPException(
                        status_code=404,
                        detail="El alumno aún no envió un entregable para esta tarea",
                    )
                merged = _normalize_deliverable_entry({**existing, "label": task.label})
                history = list(merged.get("history") or [])
                if not history:
                    raise HTTPException(
                        status_code=404,
                        detail="El alumno aún no envió un entregable para esta tarea",
                    )
                corrected_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
                latest = dict(history[-1])
                latest["director_note"] = dn or None
                latest["director_link"] = dl or None
                latest["corrected_at"] = corrected_at
                history[-1] = latest
                merged["note"] = str(latest.get("note") or "")
                merged["link"] = str(latest.get("link") or "")
                merged["submitted_at"] = str(latest.get("submitted_at") or "")
                merged["director_note"] = dn or None
                merged["director_link"] = dl or None
                merged["corrected_at"] = corrected_at
                merged["history"] = history
                task.deliverable_json = json.dumps(merged, ensure_ascii=False)
                task_title = str(merged.get("label") or task.label)
                body_parts: list[str] = []
                if dn:
                    body_parts.append(dn)
                if dl:
                    body_parts.append(f"Enlace: {dl}")
                body = "\n\n".join(body_parts)
                if len(body) > 900:
                    body = body[:897] + "..."
                models.Notification(
                    user=user,
                    title=f"Corrección del entregable: «{task_title}»",
                    body=body,
                )
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(
                    status_code=500, detail="Error al guardar la corrección"
                )

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
                    task.completed_at = datetime.utcnow()
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
