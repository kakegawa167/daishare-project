import uuid
from pydantic import BaseModel, EmailStr

from app.models.user import UserType


class UserSyncRequest(BaseModel):
    email: EmailStr
    display_name: str


class UserUpdateRequest(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    base_station_id: int | None = None
    lending_address: str | None = None
    user_type: UserType | None = None


class PushTokenRequest(BaseModel):
    expo_push_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    avatar_url: str | None
    bio: str | None
    base_station_id: int | None
    lending_address: str | None
    user_type: UserType
    expo_push_token: str | None

    model_config = {"from_attributes": True}
