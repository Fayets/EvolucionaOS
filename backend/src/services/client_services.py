import json
import logging
from datetime import datetime

from fastapi import HTTPException
from pony.orm import db_session
from src import models
from src.models import Role

logger = logging.getLogger(__name__)
PROGRAM_PHASES = [
    "Acceso",
    "Onboarding",
    "Base de Negocios",
    "Marketing",
    "Proceso de Ventas",
    "Optimizar",
]
PHASE_UNLOCKS_KEY_PREFIX = "phase_unlocks:"


def _parse_json(s: str | None) -> dict | None:
    if not s or not s.strip():
        return None
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return None


class ClientService:

    def get_or_create_client_phase(self, user_id: int) -> str:
        with db_session:
            try:
                user = models.User.get(id=user_id)
                if not user:
                    return "initial"
                client = models.Client.get(user=user)
                if not client:
                    client = models.Client(user=user, phase="initial")
                    client.flush()
                return client.phase
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al obtener fase del cliente")

    def get_client_phase_by_email(self, email: str) -> str | None:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return None
                client = models.Client.get(user=user)
                return client.phase if client else None
            except Exception:
                return None

    def set_client_phase_by_email(self, email: str, phase: str) -> bool:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return False
                client = models.Client.get(user=user)
                if not client:
                    client = models.Client(user=user, phase=phase)
                else:
                    client.phase = phase
                return True
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al actualizar fase del cliente")

    def update_client_initial_data(self, old_email: str, new_email: str, phone: str | None) -> None:
        with db_session:
            try:
                user = models.User.get(email=old_email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                user.email = new_email
                client = models.Client.get(user=user)
                if not client:
                    client = models.Client(user=user, phase="platforms", phone=phone or None, email=new_email)
                else:
                    client.phase = "platforms"
                    client.phone = phone or client.phone
                    client.email = new_email
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al actualizar datos del cliente")

    def get_onboarding_responses(self, email: str) -> dict | None:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                client = models.Client.get(user=user)
                if not client:
                    return None
                return _parse_json(client.onboarding_responses)
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al obtener onboarding")

    def set_onboarding_responses(self, email: str, responses: dict) -> bool:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                client = models.Client.get(user=user)
                if not client:
                    client = models.Client(
                        user=user,
                        phase="Onboarding",
                        onboarding_responses=json.dumps(responses),
                    )
                else:
                    client.onboarding_responses = json.dumps(responses)
                return True
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al guardar onboarding")

    def get_mandatory_task_deliverables(self, email: str) -> dict:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                client = models.Client.get(user=user)
                if not client:
                    return {}
                raw = getattr(client, "mandatory_task_deliverables", None)
                data = _parse_json(raw)
                return data if isinstance(data, dict) else {}
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(
                    status_code=500, detail="Error al obtener entregables de tareas"
                )

    def set_mandatory_task_deliverable(
        self,
        email: str,
        task_slug: str,
        task_label: str,
        note: str | None,
        link: str | None,
    ) -> None:
        with db_session:
            try:
                task = models.MandatoryTask.get(slug=task_slug.strip())
                if not task:
                    raise HTTPException(status_code=404, detail="Tarea no encontrada")
                user = models.User.get(email=email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                client = models.Client.get(user=user)
                if not client:
                    raise HTTPException(
                        status_code=404, detail="Cliente no encontrado"
                    )
                n = (note or "").strip()
                u = (link or "").strip()
                if not n and not u:
                    raise HTTPException(
                        status_code=400,
                        detail="Agregá un comentario o un enlace al entregable",
                    )
                existing = _parse_json(getattr(client, "mandatory_task_deliverables", None))
                if not isinstance(existing, dict):
                    existing = {}
                slug_key = task_slug.strip()
                existing[slug_key] = {
                    "label": task_label.strip(),
                    "note": n,
                    "link": u,
                    "submitted_at": datetime.utcnow().replace(microsecond=0).isoformat()
                    + "Z",
                }
                client.mandatory_task_deliverables = json.dumps(
                    existing, ensure_ascii=False
                )
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(
                    status_code=500, detail="Error al guardar el entregable"
                )

    def set_mandatory_task_deliverable_director_feedback(
        self,
        student_email: str,
        task_slug: str,
        director_note: str | None,
        director_link: str | None,
    ) -> None:
        with db_session:
            try:
                dn = (director_note or "").strip()
                dl = (director_link or "").strip()
                if not dn and not dl:
                    raise HTTPException(
                        status_code=400,
                        detail="Agregá un comentario o un enlace para la corrección",
                    )
                user = models.User.get(email=student_email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                client = models.Client.get(user=user)
                if not client:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                raw = getattr(client, "mandatory_task_deliverables", None)
                existing = _parse_json(raw)
                if not isinstance(existing, dict):
                    existing = {}
                slug_key = task_slug.strip()
                entry = existing.get(slug_key)
                if not isinstance(entry, dict):
                    raise HTTPException(
                        status_code=404,
                        detail="El alumno aún no envió un entregable para esta tarea",
                    )
                merged = dict(entry)
                merged["director_note"] = dn
                merged["director_link"] = dl
                merged["corrected_at"] = (
                    datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
                )
                existing[slug_key] = merged
                client.mandatory_task_deliverables = json.dumps(
                    existing, ensure_ascii=False
                )
                task_title = str(merged.get("label") or slug_key)
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

    def get_clients_list(self) -> list[dict]:
        with db_session:
            try:
                users = list(models.User.select())
                result = []
                for u in users:
                    if u.role != Role.CLIENTE:
                        continue
                    client = models.Client.get(user=u)
                    if not client:
                        continue
                    name = (u.first_name or "").strip() or (u.last_name or "").strip()
                    if not name and u.email:
                        name = u.email.split("@")[0]
                    result.append({"email": u.email, "name": name or u.email})
                return result
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al obtener lista de clientes")

    def get_manual_phase_unlocks(self, email: str) -> list[str]:
        with db_session:
            try:
                key = f"{PHASE_UNLOCKS_KEY_PREFIX}{email.strip().lower()}"
                row = models.AppSetting.get(key=key)
                if not row or not (row.value or "").strip():
                    return []
                data = json.loads(row.value)
                if not isinstance(data, list):
                    return []
                valid = {p for p in PROGRAM_PHASES}
                out = [p for p in data if isinstance(p, str) and p in valid]
                seen: set[str] = set()
                ordered: list[str] = []
                for p in out:
                    if p in seen:
                        continue
                    seen.add(p)
                    ordered.append(p)
                return ordered
            except HTTPException:
                raise
            except Exception:
                return []

    def set_manual_phase_unlocks(self, email: str, phases: list[str]) -> bool:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return False
                client = models.Client.get(user=user)
                if not client:
                    return False
                valid = {p for p in PROGRAM_PHASES}
                clean = [p for p in phases if isinstance(p, str) and p in valid]
                seen: set[str] = set()
                deduped: list[str] = []
                for p in clean:
                    if p in seen:
                        continue
                    seen.add(p)
                    deduped.append(p)
                key = f"{PHASE_UNLOCKS_KEY_PREFIX}{email.strip().lower()}"
                payload = json.dumps(deduped, ensure_ascii=False)
                row = models.AppSetting.get(key=key)
                if row:
                    row.value = payload
                else:
                    models.AppSetting(key=key, value=payload)
                return True
            except HTTPException:
                raise
            except Exception:
                return False
