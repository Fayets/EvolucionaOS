from fastapi import APIRouter, Depends, HTTPException

from src import schemas
from src.controllers.auth_controller import get_director_user
from src.services.discord_broadcast_service import broadcast_weekly_reports_to_discord

router = APIRouter()


@router.post("/difundir-reportes")
async def difundir_reportes_discord(
    payload: schemas.DiscordBroadcastRequest,
    current_user=Depends(get_director_user),
):
    try:
        _ = current_user
        return await broadcast_weekly_reports_to_discord(
            payload.mensaje, payload.destinatarios
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al difundir reportes en Discord")
