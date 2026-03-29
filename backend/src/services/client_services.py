import json
import logging
from datetime import datetime

from fastapi import HTTPException
from pony.orm import db_session
from src import models
from src.models import Role

logger = logging.getLogger(__name__)


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
