import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator

from app.models.cart import CartCategory, CartStatus
from app.models.rental_request import RequestStatus


class CartCreateRequest(BaseModel):
    title: str
    category: CartCategory | None = None
    description: str | None = None
    weight_kg: float | None = None
    max_load_kg: float | None = None
    width_cm: float | None = None
    length_cm: float | None = None
    foldable: bool = False
    daily_rate: float | None = None
    weekly_rate: float | None = None
    per_rental_rate: float | None = None
    quantity: int = 1
    image_urls: list[str] = []
    station_id: int | None = None
    lending_address: str | None = None

    @model_validator(mode="after")
    def at_least_one_price(self) -> "CartCreateRequest":
        if not any([self.daily_rate, self.weekly_rate, self.per_rental_rate]):
            raise ValueError("日額・週額・1レンタルのいずれかを入力してください")
        return self


class CartUpdateRequest(BaseModel):
    title: str | None = None
    category: CartCategory | None = None
    description: str | None = None
    weight_kg: float | None = None
    max_load_kg: float | None = None
    width_cm: float | None = None
    length_cm: float | None = None
    foldable: bool | None = None
    daily_rate: float | None = None
    weekly_rate: float | None = None
    per_rental_rate: float | None = None
    quantity: int | None = None
    image_urls: list[str] | None = None
    station_id: int | None = None
    lending_address: str | None = None
    status: CartStatus | None = None


class CartResponse(BaseModel):
    id: int
    owner_id: uuid.UUID
    title: str
    category: CartCategory | None = None
    description: str | None
    weight_kg: float | None = None
    max_load_kg: float | None = None
    width_cm: float | None = None
    length_cm: float | None = None
    foldable: bool = False
    daily_rate: float | None = None
    weekly_rate: float | None = None
    per_rental_rate: float | None = None
    quantity: int
    image_urls: list[str]
    station_id: int | None
    lending_address: str | None = None
    status: CartStatus
    owner_name: str | None = None
    station_name: str | None = None
    municipality: str | None = None

    model_config = {"from_attributes": True}


class RentalRequestUpdate(BaseModel):
    start_date: datetime | None = None
    end_date: datetime | None = None
    quantity: int | None = None
    message: str | None = None


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
    lender_name: str | None = None
    station_name: str | None = None
    municipality: str | None = None
    lending_address: str | None = None
    last_message_body: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0

    model_config = {"from_attributes": True}
