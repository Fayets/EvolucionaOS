from fastapi import HTTPException, APIRouter, Depends, Form
from jose import jwt, JWTError
from src import schemas
from src.services.user_services import UsersService
from src.services.client_services import ClientService
from src.models import Role
from decouple import config
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta

router = APIRouter()

service = UsersService()
client_service = ClientService()

SECRET_KEY = config("SECRET")
ACCESS_TOKEN_DURATION = 60
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Cualquier usuario autenticado."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        try:
            uid = int(user_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=401, detail="Token inválido")
        user = service.search_user_by_id(uid)
        if user is None:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except HTTPException:
        raise
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


async def get_staff_user(current_user=Depends(get_current_user)):
    """Solo roles internos (no CLIENTE)."""
    if current_user.role == Role.CLIENTE:
        raise HTTPException(status_code=403, detail="Acceso solo para personal interno")
    return current_user


async def get_director_user(current_user=Depends(get_current_user)):
    """Solo SISTEMAS (director/admin del sistema)."""
    if current_user.role != Role.SISTEMAS:
        raise HTTPException(status_code=403, detail="Acceso solo para director")
    return current_user


@router.post("/verify-token")
async def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = service.search_user_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return {
            "message": "Token válido",
            "user": {
                "email": user.email,
                "role": str(user.role),
            }
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

@router.post("/register", response_model=schemas.RegisterMessage, status_code=201)
async def register(user: schemas.UserCreate):
    try:
        service.create_user(user)
        return {"message": "Usuario creado correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al crear el usuario.", "success": False}


@router.post("/login")
async def login(
    email: str = Form(..., description="Email del usuario"),
    password: str = Form(..., description="Contraseña del usuario"),
):
    if not email or not password:
        raise HTTPException(status_code=400, detail="Campos requeridos")

    user = service.search_user(
        username=None, email=email, password=password)

    access_token = {"id": str(user.id), "exp":datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_DURATION)}

    response = {
        "message": "Usuario logeado correctamente",
        "success": True,
        "access_token": jwt.encode(access_token, key=SECRET_KEY, algorithm="HS256"),
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
    }
    # Para clientes, devolver la fase guardada para no repetir pantallas ya completadas
    if user.role == Role.CLIENTE:
        response["client_phase"] = client_service.get_or_create_client_phase(user.id)
    return response