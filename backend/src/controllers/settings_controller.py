import subprocess
from pathlib import Path

from decouple import config
from fastapi import APIRouter, Depends, HTTPException
from src import schemas
from src.services.settings_services import SettingsService
from src.controllers.auth_controller import get_current_user, get_director_user

router = APIRouter()
service = SettingsService()

# Cualquier carpeta dentro del repo sirve: git resuelve .git hacia arriba.
_GIT_CWD = Path(__file__).resolve().parent


def _git_output(args: list[str]) -> str | None:
    try:
        out = subprocess.run(
            ["git", *args],
            cwd=_GIT_CWD,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if out.returncode != 0 or not (out.stdout or "").strip():
            return None
        return out.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return None


def _commit_sha_from_git() -> str:
    return _git_output(["rev-parse", "HEAD"]) or ""


def _github_repository_from_remote() -> str:
    url = _git_output(["remote", "get-url", "origin"])
    if not url:
        return ""
    u = url.rstrip("/").removesuffix(".git")
    if u.startswith("git@"):
        tail = u.split(":", 1)[-1]
        return tail if "/" in tail else ""
    marker = "github.com/"
    i = u.find(marker)
    if i == -1:
        return ""
    rest = u[i + len(marker) :]
    parts = rest.split("/")
    if len(parts) < 2:
        return ""
    return f"{parts[0]}/{parts[1]}"


@router.get("/discord-link", response_model=schemas.DiscordLinkResponse)
def get_discord_link(current_user=Depends(get_current_user)):
    try:
        url = service.get_discord_link()
        return schemas.DiscordLinkResponse(url=url)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al obtener link de Discord")


@router.get("/deploy-info", response_model=schemas.DeployInfoResponse)
def get_deploy_info(_current_user=Depends(get_director_user)):
    sha = (config("GIT_COMMIT_SHA", default="") or "").strip() or _commit_sha_from_git()
    repo = (config("GITHUB_REPOSITORY", default="") or "").strip() or _github_repository_from_remote()
    commit_url = None
    if sha and repo:
        commit_url = f"https://github.com/{repo}/commit/{sha}"
    return schemas.DeployInfoResponse(commit_sha=sha, commit_url=commit_url)


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
