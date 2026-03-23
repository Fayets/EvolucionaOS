from fastapi import APIRouter, Depends, HTTPException
from src import schemas
from src.services.settings_services import SettingsService
from src.controllers.auth_controller import get_current_user

router = APIRouter()
service = SettingsService()


@router.get("/discord-link", response_model=schemas.DiscordLinkResponse)
def get_discord_link(current_user=Depends(get_current_user)):
    try:
        url = service.get_discord_link()
        return schemas.DiscordLinkResponse(url=url)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener link de Discord")


@router.put("/discord-link")
def set_discord_link(
    payload: schemas.DiscordLinkUpdate,
    current_user=Depends(get_current_user),
):
    try:
        service.set_discord_link(payload.url)
        return {"message": "Link de Discord actualizado", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al guardar link.", "success": False}
