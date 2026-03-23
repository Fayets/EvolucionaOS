import asyncio
import json
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from src.sse_broadcast import add_listener, remove_listener
from src.notifications_broadcast import add_user_listener, remove_user_listener

router = APIRouter()

KEEPALIVE_INTERVAL = 25


async def _stream_activation_tasks():
    q = add_listener()
    try:
        while True:
            try:
                msg = await asyncio.wait_for(q.get(), timeout=KEEPALIVE_INTERVAL)
                yield f"data: {json.dumps(msg)}\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        remove_listener(q)


@router.get("/activation-tasks")
def stream_activation_tasks_events():
    return StreamingResponse(
        _stream_activation_tasks(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _stream_user_notifications(email: str):
    q = add_user_listener(email)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(q.get(), timeout=KEEPALIVE_INTERVAL)
                yield f"data: {json.dumps(msg)}\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        remove_user_listener(email, q)


@router.get("/notifications")
def stream_user_notifications_events(email: str = Query(..., description="Email del usuario")):
    return StreamingResponse(
        _stream_user_notifications(email),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
