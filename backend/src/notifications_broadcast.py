"""
Broadcaster SSE por usuario: notifica solo al cliente cuando tiene una notificación nueva
(por ejemplo, cuando el director marca una tarea como completada).
"""
import asyncio
import threading
from collections import defaultdict

# email -> list of queues for that user
_user_queues: dict[str, list[asyncio.Queue]] = defaultdict(list)
_lock = threading.Lock()


def add_user_listener(email: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    with _lock:
        _user_queues[email].append(q)
    return q


def remove_user_listener(email: str, q: asyncio.Queue) -> None:
    with _lock:
        if email in _user_queues and q in _user_queues[email]:
            _user_queues[email].remove(q)
            if not _user_queues[email]:
                del _user_queues[email]


def broadcast_to_user(email: str, payload: dict) -> None:
    """Debe ser llamada desde el event loop (ej. vía call_soon_threadsafe)."""
    with _lock:
        queues_copy = list(_user_queues.get(email, []))
    for q in queues_copy:
        try:
            q.put_nowait(payload)
        except Exception:
            pass
