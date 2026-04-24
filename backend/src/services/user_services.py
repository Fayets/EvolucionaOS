import logging
import bcrypt
from fastapi import HTTPException
from pony.orm import TransactionIntegrityError, db_session, desc
from src import models, schemas
from src.models import Role

logger = logging.getLogger(__name__)


class UsersService:

    def create_user(self, user: schemas.UserCreate) -> schemas.UserRead:
        with db_session:
            try:
                role_value = Role(user.role.value)
                entity = models.User(
                    email=user.email,
                    password_hash=_hash_password(user.password),
                    role=role_value,
                    first_name=user.firstName or None,
                    last_name=user.lastName or None,
                )
                entity.flush()
                # Ficha de cliente: sin esto get_user_detail devuelve client: null y el panel del director queda “vacío”.
                if role_value == Role.CLIENTE:
                    models.Client(user=entity, phase="initial")
                return schemas.UserRead(
                    id=entity.id,
                    email=entity.email,
                    role=user.role,
                    created_at=entity.created_at,
                    updated_at=entity.updated_at,
                )
            except HTTPException:
                raise
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="Email ya registrado")
            except Exception:
                raise HTTPException(status_code=500, detail="Error al crear el usuario")

    def _apply_user_sort(self, query, sort: str | None, order: str | None):
        """Atributos de entidad en order_by: lambdas/generadores y Pony rompen con Python 3.13 (bytecode)."""
        if not sort:
            return query
        desc_order = (order or "asc").lower() == "desc"
        U = models.User
        if sort == "email":
            return query.order_by(desc(U.email) if desc_order else U.email)
        if sort == "id":
            return query.order_by(desc(U.id) if desc_order else U.id)
        if sort == "created_at":
            return query.order_by(desc(U.created_at) if desc_order else U.created_at)
        if sort == "updated_at":
            return query.order_by(desc(U.updated_at) if desc_order else U.updated_at)
        if sort == "role":
            return query.order_by(desc(U.role) if desc_order else U.role)
        return query

    def get_users(
        self,
        page: int = 1,
        count: int = 10,
        sort: str | None = None,
        order: str | None = "asc",
        role: Role | None = None,
    ):
        with db_session:
            try:
                query = (
                    models.User.select(role=role)
                    if role is not None
                    else models.User.select()
                )

                query = self._apply_user_sort(query, sort, order)

                # Contar antes de paginar (evita inconsistencias en algunas versiones de Pony).
                total = query.count()
                users = query.page(page, count)

                # No usar to_dict(): incluye relaciones / tipos que rompen JSON o filtran password_hash.
                users_conversion = []
                for user in users:
                    client_phase = None
                    if user.role == Role.CLIENTE:
                        client = models.Client.get(user=user)
                        if client is not None:
                            client_phase = client.phase
                    users_conversion.append(
                        {
                            "id": user.id,
                            "email": user.email,
                            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                            "created_at": user.created_at.isoformat() if user.created_at else None,
                            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                            "client_phase": client_phase,
                        }
                    )

                return {
                    "page": page,
                    "count": len(users_conversion),
                    "total": total,
                    "users": users_conversion,
                }
            except HTTPException:
                raise
            except Exception:
                logger.exception("get_users")
                raise HTTPException(status_code=500, detail="Error al obtener usuarios")

    def search_user(self, username: str | None, email: str | None, password: str):
        with db_session:
            effective_email = email or username
            if not effective_email:
                raise HTTPException(status_code=400, detail="Email o username requerido")

            user = models.User.get(email=effective_email)
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            if not _check_password(user.password_hash, password):
                raise HTTPException(status_code=401, detail="Contraseña incorrecta")

            return user

    def search_user_by_id(self, user_id: int):
        with db_session:
            try:
                user = models.User.get(id=user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                return user
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al buscar usuario por id")

    def get_user_detail_by_email(self, email: str) -> dict:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                out = {
                    "id": user.id,
                    "email": user.email,
                    "role": str(user.role),
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                }
                client = models.Client.get(user=user)
                if client:
                    from .client_services import _normalize_deliverable_entry, _parse_json

                    md = _parse_json(getattr(client, "mandatory_task_deliverables", None))
                    if not isinstance(md, dict):
                        md = None
                    particular_deliverables: dict = {}
                    for t in list(client.particular_tasks):
                        dj = getattr(t, "deliverable_json", None) or ""
                        if not str(dj).strip():
                            continue
                        parsed = _parse_json(dj)
                        if not isinstance(parsed, dict):
                            continue
                        particular_deliverables[str(t.id)] = _normalize_deliverable_entry(
                            {**parsed, "label": t.label}
                        )
                    out["client"] = {
                        "phase": client.phase,
                        "phone": client.phone,
                        "email": client.email,
                        "onboarding_responses": _parse_json(client.onboarding_responses),
                        "mandatory_task_deliverables": md,
                        "particular_task_deliverables": particular_deliverables,
                    }
                else:
                    out["client"] = None
                return out
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al obtener usuario")

    def delete_user_by_email(self, email: str) -> bool:
        with db_session:
            try:
                user = models.User.get(email=email)
                if not user:
                    return False
                for n in list(user.notifications):
                    n.delete()
                client = models.Client.get(user=user)
                if client:
                    client.delete()
                user.delete()
                return True
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al eliminar usuario")


def _hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def _check_password(stored_password: str, provided_password: str) -> bool:
    return bcrypt.checkpw(
        provided_password.encode("utf-8"), stored_password.encode("utf-8")
    )
