from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ─── Enums ───────────────────────────────────────────────────────────

class RoleEnum(str, Enum):
    SISTEMAS = "SISTEMAS"
    MARKETING = "MARKETING"
    VENTAS = "VENTAS"
    DELIVERY = "DELIVERY"
    CLIENTE = "CLIENTE"


# ─── Auth ────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr
    role: RoleEnum = Field(default=RoleEnum.SISTEMAS)


class UserCreate(UserBase):
    password: str = Field(min_length=6)
    username: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None


class UserRead(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: str


class RegisterMessage(BaseModel):
    message: str
    success: bool


# ─── Users / Clients ────────────────────────────────────────────────

class UpdateEmailRequest(BaseModel):
    old_email: EmailStr
    new_email: EmailStr
    phone: Optional[str] = None


class ClientPhaseRequest(BaseModel):
    email: EmailStr
    phase: str


class PhaseAdvanceRequest(BaseModel):
    email: EmailStr
    next_phase: str


# ─── Onboarding ─────────────────────────────────────────────────────

class OnboardingSubmitRequest(BaseModel):
    email: EmailStr
    responses: dict


class MandatoryDeliverableSubmitRequest(BaseModel):
    email: EmailStr
    task_slug: str = Field(min_length=1)
    task_label: str = Field(min_length=1)
    note: str | None = None
    link: str | None = None


# ─── Activation Tasks ───────────────────────────────────────────────

class SkoolClickRequest(BaseModel):
    email: EmailStr


class DiscordClickRequest(BaseModel):
    email: EmailStr


class UpdateActivationTaskRequest(BaseModel):
    completed: Optional[bool] = None
    is_new: Optional[bool] = None


# ─── Mandatory Tasks ────────────────────────────────────────────────

class MandatoryTaskCompleteRequest(BaseModel):
    email: EmailStr
    task_slug: str
    completed: bool = True


class AssignMandatoryTaskRequest(BaseModel):
    email: EmailStr
    task_slug: str


class MandatoryTaskCreate(BaseModel):
    label: str
    link_url: str | None = None
    deliverable_links: list[str] = Field(default_factory=list)
    phase: str = "Acceso"
    slug: str | None = None


class MandatoryTaskUpdate(BaseModel):
    label: str | None = None
    link_url: str | None = None
    deliverable_links: list[str] | None = None


# ─── Particular Tasks ───────────────────────────────────────────────

class CreateParticularTaskRequest(BaseModel):
    email: EmailStr
    phase: str
    label: str
    link_url: str | None = None


class ParticularTaskCompleteRequest(BaseModel):
    email: EmailStr
    completed: bool = True


# ─── Settings ────────────────────────────────────────────────────────

class DiscordLinkResponse(BaseModel):
    url: str | None


class DiscordLinkUpdate(BaseModel):
    url: str

