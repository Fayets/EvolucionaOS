import json
import logging
import urllib.error
import urllib.request
from urllib.parse import urlparse

from decouple import config
from pony.orm import db_session

from src import models

logger = logging.getLogger(__name__)


def _is_reasonable_http_url(url: str) -> bool:
    try:
        p = urlparse(url.strip())
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False


@db_session
def count_registered_channels_for_director(director_id: int) -> int:
    director = models.User.get(id=director_id)
    if not director:
        return 0
    return models.RegisteredUser.select(created_by=director).count()


def broadcast_kpi_form_link(director_id: int, form_url: str) -> tuple[int, int, int]:
    """
    Envía `form_url` a webhooks de Discord listados en DISCORD_KPI_WEBHOOKS (coma-separados).
    Retorna (sent, failed, channels_registered).
    """
    if not _is_reasonable_http_url(form_url):
        raise ValueError("URL del formulario inválida")

    channels = count_registered_channels_for_director(director_id)

    raw = config("DISCORD_KPI_WEBHOOKS", default="").strip()
    webhooks = [w.strip() for w in raw.split(",") if w.strip() and _is_reasonable_http_url(w.strip())]
    if not webhooks:
        return 0, 0, channels

    body = json.dumps(
        {
            "content": f"📊 **Reporte semanal Evoluciona**\nCompletá el formulario: {form_url.strip()}",
        }
    ).encode("utf-8")

    sent = 0
    failed = 0
    for wh in webhooks:
        try:
            req = urllib.request.Request(
                wh,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                code = getattr(resp, "status", None) or resp.getcode()
                if 200 <= int(code) < 300:
                    sent += 1
                else:
                    failed += 1
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError) as e:
            logger.warning("Discord webhook falló: %s", e)
            failed += 1

    return sent, failed, channels
