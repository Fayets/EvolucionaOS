import logging
from fastapi import HTTPException
from pony.orm import db_session
from src import models

logger = logging.getLogger(__name__)

DISCORD_LINK_KEY = "discord_link"


class SettingsService:

    def get_discord_link(self) -> str | None:
        with db_session:
            try:
                row = models.AppSetting.get(key=DISCORD_LINK_KEY)
                return row.value if row else None
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al obtener link de Discord")

    def set_discord_link(self, url: str) -> None:
        with db_session:
            try:
                row = models.AppSetting.get(key=DISCORD_LINK_KEY)
                if row:
                    row.value = url or ""
                else:
                    models.AppSetting(key=DISCORD_LINK_KEY, value=url or "")
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al guardar link de Discord")
