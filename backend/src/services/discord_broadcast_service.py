import asyncio
import logging

import httpx
from pony.orm import db_session

from src import models

logger = logging.getLogger(__name__)


@db_session
def _clients_with_discord_webhook_for_emails(targets: set[str]) -> list[dict]:
    out: list[dict] = []
    if not targets:
        return out
    for client in models.Client.select():
        webhook = (getattr(client, "discord_webhook_url", None) or "").strip()
        user_email = ""
        if getattr(client, "user", None) is not None:
            user_email = str(getattr(client.user, "email", "") or "").strip()
        if not user_email:
            continue
        if user_email.lower() not in targets:
            continue
        if not webhook:
            continue
        out.append({"email": user_email, "webhook": webhook})
    return out


async def _send_one(
    client: httpx.AsyncClient, email: str, webhook: str, message: str
) -> dict | None:
    try:
        res = await client.post(
            webhook,
            json={"content": message},
        )
        if 200 <= res.status_code < 300:
            return None
        detail = f"HTTP {res.status_code}"
        if res.text:
            detail = f"{detail}: {res.text[:300]}"
        return {"email": email or "sin-email", "error": detail}
    except Exception as e:
        logger.warning("Error difundiendo reporte a %s: %s", email, e)
        return {"email": email or "sin-email", "error": str(e)}


async def broadcast_weekly_reports_to_discord(message: str, recipients: list[str]) -> dict:
    normalized_message = (message or "").strip()
    if not normalized_message:
        raise ValueError("Mensaje requerido")
    requested: set[str] = {
        str(email).strip().lower()
        for email in recipients
        if str(email).strip()
    }
    if not requested:
        raise ValueError("Seleccioná al menos un destinatario")

    targets = _clients_with_discord_webhook_for_emails(requested)
    found_with_webhook = {str(t["email"]).strip().lower() for t in targets}
    missing = sorted(requested - found_with_webhook)

    async with httpx.AsyncClient(timeout=15.0) as client:
        tasks = [
            _send_one(client, str(t["email"]), str(t["webhook"]), normalized_message)
            for t in targets
        ]
        results = await asyncio.gather(*tasks) if tasks else []

    send_errors = [r for r in results if r is not None]
    errors = list(send_errors)
    errors.extend(
        {
            "email": email,
            "error": "Sin webhook configurado o cliente inexistente",
        }
        for email in missing
    )
    sent = len(targets) - len(send_errors)
    return {"enviados": sent, "errores": errors}
