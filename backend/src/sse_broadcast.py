"""
Broadcaster para Server-Sent Events: notifica a todos los clientes conectados
cuando cambian las tareas de activación (sin polling).
"""
import asyncio
import threading

_queues: list[asyncio.Queue] = []
_lock = threading.Lock()

EVENT_ACTIVATION_TASKS_CHANGED = "activation_tasks_changed"


def add_listener() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    with _lock:
        _queues.append(q)
    return q


def remove_listener(q: asyncio.Queue) -> None:
    with _lock:
        if q in _queues:
            _queues.remove(q)


def broadcast(event: str, data: dict | None = None) -> None:
    """Debe ser llamada desde el event loop (ej. vía call_soon_thread_safe)."""
    payload = {"type": event}
    if data is not None:
        payload.update(data)
    with _lock:
        queues_copy = list(_queues)
    for q in queues_copy:
        try:
            q.put_nowait(payload)
        except Exception:
            pass
