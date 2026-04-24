from fastapi import APIRouter, Depends, HTTPException

from src import schemas
from src.controllers.auth_controller import get_director_user
from src.services.discord_kpi_service import (
    broadcast_kpi_form_link,
    count_registered_channels_for_director,
)

router = APIRouter()


@router.get("/kpi-channels-count", response_model=schemas.KpiChannelsCountResponse)
def kpi_channels_count(current_user=Depends(get_director_user)):
    try:
        n = count_registered_channels_for_director(current_user.id)
        return schemas.KpiChannelsCountResponse(channels_registered=n)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al contar canales")


@router.post("/broadcast-kpi", response_model=schemas.BroadcastKpiResponse)
def broadcast_kpi(
    payload: schemas.BroadcastKpiRequest,
    current_user=Depends(get_director_user),
):
    try:
        sent, failed, channels = broadcast_kpi_form_link(
            current_user.id, payload.form_url
        )
        return schemas.BroadcastKpiResponse(
            sent=sent, failed=failed, channels_registered=channels
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al difundir en Discord")
