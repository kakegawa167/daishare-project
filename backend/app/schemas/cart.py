import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.cart import CartStatus
from app.models.rental_request import RequestStatus


class CartCreateRequest(BaseModel):
    title: str
    description: str | None = None
    daily_rate: float
    quantity: int = 1
    image_urls: list[str] = []
    station_id: int | None = None


class CartUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    daily_rate: float | None = None
    quantity: int | None = None
    image_urls: list[str] | None = None
    station_id: int | None = None
    status: CartStatus | None = None


class CartResponse(BaseModel):
    id: int
    owner_id: uuid.UUID
    title: str
    description: str | None
    daily_rate: float
    quantity: int
    image_urls: list[str]
    station_id: int | None
    status: CartStatus
    owner_name: str | None = None
    station_name: str | None = None
    municipality: str | None = None

    model_config = {"from_attributes": True}


class RentalRequestCreate(BaseModel):
    cart_id: int
    quantity: int = 1
    start_date: datetime
    end_date: datetime
    message: str | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: datetime, info) -> datetime:
        if "start_date" in info.data and v <= info.data["start_date"]:
            raise ValueError("end_date must be after start_date")
        return v


class RentalRequestResponse(BaseModel):
    id: int
    cart_id: int
    renter_id: uuid.UUID
    quantity: int
    start_date: datetime
    end_date: datetime
    message: str | None
    status: RequestStatus
    created_at: datetime
    cart_title: str | None = None
    renter_name: str | None = None

    model_config = {"from_attributes": True}
