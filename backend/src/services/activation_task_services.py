import logging
from fastapi import HTTPException
from pony.orm import db_session
from src import models
from src.client_phases import canonicalize_target_phase, expected_next_program_phase

logger = logging.getLogger(__name__)

# Python 3.13 + Pony: iterar `Entity.select()` / `select()[:]` puede lanzar
# QueryResultIterator not iterable. Para filtros usamos select_by_sql.


def _activation_tasks_select_all_sql() -> list:
    """Todas las ActivationTask vía SQL (lista materializada)."""
    try:
        return models.ActivationTask.select_by_sql("SELECT * FROM activationtask")
    except Exception:
        try:
            return models.ActivationTask.select_by_sql('SELECT * FROM "ActivationTask"')
        except Exception:
            return []


def _activation_tasks_pending_phase_advance(email: str) -> list:
    """Solicitudes de avance de fase pendientes para un email (Neon/Postgres)."""
    g = {"phase_adv_email": email}
    sql_lo = (
        "SELECT * FROM activationtask WHERE client_email = $phase_adv_email "
        "AND requested_next_phase IS NOT NULL AND completed = false LIMIT 4"
    )
    sql_q = (
        'SELECT * FROM "ActivationTask" WHERE client_email = $phase_adv_email '
        "AND requested_next_phase IS NOT NULL AND completed = false LIMIT 4"
    )
    try:
        return models.ActivationTask.select_by_sql(sql_lo, globals=g)
    except Exception:
        try:
            return models.ActivationTask.select_by_sql(sql_q, globals=g)
        except Exception:
            return []


class ActivationTaskService:

    def create_skool_click_task(self, email: str) -> None:
        with db_session:
            try:
                user = models.User.get(email=email)
                if user and (user.first_name or user.last_name):
                    client_name = " ".join(p for p in [user.first_name, user.last_name] if p).strip()
                else:
                    client_name = email.split("@")[0].capitalize()
                task = models.ActivationTask(
                    client_name=client_name,
                    client_email=email,
                    description="El cliente hizo clic en 'Ingresar a Skool'",
                    completed=False,
                    is_new=True,
                )
                task.flush()
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("create_skool_click_task: %s", e)
                raise HTTPException(status_code=500, detail="Error al crear tarea de activación")

    def create_discord_click_task(self, email: str) -> None:
        with db_session:
            try:
                user = models.User.get(email=email)
                if user and (user.first_name or user.last_name):
                    client_name = " ".join(p for p in [user.first_name, user.last_name] if p).strip()
                else:
                    client_name = email.split("@")[0].capitalize()
                task = models.ActivationTask(
                    client_name=client_name,
                    client_email=email,
                    description="El cliente ingresó a Discord - crear canal privado",
                    completed=False,
                    is_new=True,
                )
                task.flush()
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("create_discord_click_task: %s", e)
                raise HTTPException(status_code=500, detail="Error al crear tarea de activación")

    def create_phase_advance_request(self, email: str, next_phase: str) -> tuple[bool, str]:
        """Crea tarea para que el director apruebe el paso a la siguiente fase."""
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return False, "Usuario no encontrado"
                client = models.Client.get(user=user)
                if not client:
                    return False, "Cliente no encontrado"
                expected = expected_next_program_phase(client.phase)
                target = canonicalize_target_phase(next_phase)
                if (
                    expected is None
                    or target is None
                    or target != expected
                ):
                    return False, "Transición de fase no válida"
                pending = _activation_tasks_pending_phase_advance(email)
                if pending:
                    return True, "Ya tenés una solicitud pendiente de aprobación"
                if user.first_name or user.last_name:
                    client_name = " ".join(
                        p for p in [user.first_name, user.last_name] if p
                    ).strip()
                else:
                    client_name = email.split("@")[0].capitalize()
                task = models.ActivationTask(
                    client=client,
                    client_name=client_name,
                    client_email=email,
                    description=(
                        f'Solicitud de aprobación: pasar a la fase "{target}" '
                        f'(fase actual en sistema: "{client.phase}")'
                    ),
                    requested_next_phase=target,
                    completed=False,
                    is_new=True,
                )
                task.flush()
                return True, "Solicitud enviada al director"
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("create_phase_advance_request: %s", e)
                return False, "Error al registrar la solicitud"

    def create_phase_completed_task(self, email: str, phase: str) -> None:
        with db_session:
            try:
                user = models.User.get(email=email)
                if user and (user.first_name or user.last_name):
                    client_name = " ".join(p for p in [user.first_name, user.last_name] if p).strip()
                else:
                    client_name = email.split("@")[0].capitalize()
                client = models.Client.get(user=user) if user else None
                task = models.ActivationTask(
                    client=client,
                    client_name=client_name,
                    client_email=email,
                    description=f'Completó la fase "{phase}"',
                    completed=False,
                    is_new=True,
                )
                task.flush()
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("create_phase_completed_task: %s", e)

    def _fetch_activation_tasks_raw(self) -> list[dict]:
        """Lista todas las tareas como dicts; usa raw SQL para evitar generators en Python 3.13."""
        with db_session:
            try:
                rows = _activation_tasks_select_all_sql()
            except Exception:
                return []
            out = []
            for t in rows:
                display_name = t.client_name
                user = models.User.get(email=t.client_email)
                if user and (user.first_name or user.last_name):
                    display_name = " ".join(p for p in [user.first_name, user.last_name] if p).strip()
                out.append({
                    "id": t.id,
                    "clientName": display_name,
                    "clientEmail": t.client_email,
                    "description": t.description,
                    "requestedNextPhase": t.requested_next_phase,
                    "completed": t.completed,
                    "isNew": t.is_new,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                })
            return out

    def get_new_activation_tasks_count(self) -> int:
        with db_session:
            try:
                tasks = self._fetch_activation_tasks_raw()
                return sum(1 for t in tasks if t.get("isNew", False) and not t.get("completed", False))
            except Exception as e:
                logger.exception("get_new_activation_tasks_count: %s", e)
                return 0

    def get_activation_tasks_list(self) -> list[dict]:
        with db_session:
            try:
                return self._fetch_activation_tasks_raw()
            except Exception as e:
                logger.exception("get_activation_tasks_list: %s", e)
                return []

    def delete_completed_tasks(self) -> int:
        with db_session:
            try:
                rows = list(
                    models.ActivationTask.select_by_sql(
                        "SELECT * FROM activationtask WHERE completed = true"
                    )
                )
            except Exception:
                try:
                    rows = list(
                        models.ActivationTask.select_by_sql(
                            'SELECT * FROM "ActivationTask" WHERE completed = true'
                        )
                    )
                except Exception:
                    return 0
            count = len(rows)
            for t in rows:
                t.delete()
            return count

    def update_activation_task(
        self, task_id: int, completed: bool | None = None, is_new: bool | None = None
    ) -> bool:
        with db_session:
            try:
                from datetime import datetime as dt

                task = models.ActivationTask.get(id=task_id)
                if not task:
                    return False
                if completed is not None:
                    task.completed = completed
                    if completed and task.requested_next_phase:
                        user = models.User.get(email=task.client_email)
                        if user:
                            client = models.Client.get(user=user)
                            if client:
                                client.phase = task.requested_next_phase
                    if completed:
                        task.completed_at = dt.utcnow()
                    else:
                        task.completed_at = None
                if is_new is not None:
                    task.is_new = is_new
                return True
            except Exception:
                return False
