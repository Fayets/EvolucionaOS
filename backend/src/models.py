from datetime import datetime
from enum import Enum
from pony.orm import *
from .db import db


class Role(str, Enum):
    SISTEMAS = "SISTEMAS"
    MARKETING = "MARKETING"
    VENTAS = "VENTAS"
    DELIVERY = "DELIVERY"
    CLIENTE = "CLIENTE"


class User(db.Entity):
    id = PrimaryKey(int, auto=True)
    email = Required(str, unique=True)
    password_hash = Required(str)
    first_name = Optional(str)
    last_name = Optional(str)
    # Rol del usuario en el sistema
    role = Required(Role)
    created_at = Required(datetime, default=datetime.utcnow)
    updated_at = Required(datetime, default=datetime.utcnow)

    client = Optional("Client")
    notifications = Set("Notification")
    authored_tickets = Set("Ticket", reverse="author")
    assigned_tickets = Set("Ticket", reverse="assignee")
    registered_users_created = Set("RegisteredUser", reverse="created_by")


class Client(db.Entity):
    id = PrimaryKey(int, auto=True)
    user = Required(User, unique=True)
    # 'initial' | 'platforms' | 'tasks' | 'onboarding' | 'done'
    phase = Required(str)
    phone = Optional(str)
    email = Optional(str)
    # JSON: dict con respuestas del formulario de onboarding (claves q1, q2, ...)
    onboarding_responses = Optional(str)
    created_at = Required(datetime, default=datetime.utcnow)
    updated_at = Required(datetime, default=datetime.utcnow)

    platform_requests = Set("ClientPlatformRequest")
    mandatory_tasks = Set("ClientMandatoryTask")
    particular_tasks = Set("ClientParticularTask")
    activation_tasks = Set("ActivationTask")


class Platform(db.Entity):
    id = PrimaryKey(int, auto=True)
    slug = Required(str, unique=True)
    name = Required(str)
    description = Optional(str)

    requests = Set("ClientPlatformRequest")


class ClientPlatformRequest(db.Entity):
    id = PrimaryKey(int, auto=True)
    client = Required(Client)
    platform = Required(Platform)
    requested_at = Required(datetime, default=datetime.utcnow)
    granted_at = Optional(datetime)


class MandatoryTask(db.Entity):
    id = PrimaryKey(int, auto=True)
    slug = Required(str, unique=True)
    label = Required(str)
    link_url = Optional(str)
    order = Optional(int)
    phase = Required(str, default="Acceso")

    client_tasks = Set("ClientMandatoryTask")


class ClientMandatoryTask(db.Entity):
    id = PrimaryKey(int, auto=True)
    client = Required(Client)
    mandatory_task = Required(MandatoryTask)
    completed = Required(bool, default=False)
    completed_at = Optional(datetime)
    created_at = Required(datetime, default=datetime.utcnow)


class ClientParticularTask(db.Entity):
    """Tarea particular creada por el director para un alumno en una fase."""
    id = PrimaryKey(int, auto=True)
    client = Required(Client)
    phase = Required(str)
    label = Required(str)
    link_url = Optional(str)
    completed = Required(bool, default=False)
    completed_at = Optional(datetime)
    created_at = Required(datetime, default=datetime.utcnow)


class ActivationTask(db.Entity):
    id = PrimaryKey(int, auto=True)
    client = Optional(Client)
    client_name = Required(str)
    client_email = Required(str)
    description = Required(str)
    completed = Required(bool, default=False)
    is_new = Required(bool, default=True)
    created_at = Required(datetime, default=datetime.utcnow)
    completed_at = Optional(datetime)


class Ticket(db.Entity):
    id = PrimaryKey(int, auto=True)
    author = Required(User, reverse="authored_tickets")
    assignee = Optional(User, reverse="assigned_tickets")
    title = Required(str)
    body = Optional(str)
    status = Required(str, default="open")
    created_at = Required(datetime, default=datetime.utcnow)
    updated_at = Required(datetime, default=datetime.utcnow)


class Notification(db.Entity):
    id = PrimaryKey(int, auto=True)
    # Si user es None, podría interpretarse como notificación global del sistema
    user = Optional(User)
    title = Required(str)
    body = Optional(str)
    read_at = Optional(datetime)
    created_at = Required(datetime, default=datetime.utcnow)


class RegisteredUser(db.Entity):
    id = PrimaryKey(int, auto=True)
    username = Required(str, unique=True)
    password_hash = Required(str)
    created_at = Required(datetime, default=datetime.utcnow)

    created_by = Required(User, reverse="registered_users_created")


class AppSetting(db.Entity):
    """Configuración global (ej. link de Discord para clientes)."""
    id = PrimaryKey(int, auto=True)
    key = Required(str, unique=True)
    value = Optional(str)

