import logging
import json
from fastapi import HTTPException
from pony.orm import db_session
from src import models

logger = logging.getLogger(__name__)

DISCORD_LINK_KEY = "discord_link"
PHASE_IMAGES_KEY = "phase_images"


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

    def get_phase_images(self) -> dict[str, str]:
        with db_session:
            try:
                row = models.AppSetting.get(key=PHASE_IMAGES_KEY)
                raw = row.value if row and row.value else "{}"
                data = json.loads(raw)
                if not isinstance(data, dict):
                    return {}
                out: dict[str, str] = {}
                for k, v in data.items():
                    if isinstance(k, str) and isinstance(v, str):
                        out[k] = v
                return out
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al obtener imagenes de fases")

    def set_phase_images(self, images: dict[str, str]) -> None:
        with db_session:
            try:
                clean: dict[str, str] = {}
                for k, v in images.items():
                    if isinstance(k, str) and isinstance(v, str):
                        clean[k] = v.strip()
                payload = json.dumps(clean, ensure_ascii=False)
                row = models.AppSetting.get(key=PHASE_IMAGES_KEY)
                if row:
                    row.value = payload
                else:
                    models.AppSetting(key=PHASE_IMAGES_KEY, value=payload)
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=500, detail="Error al guardar imagenes de fases")
