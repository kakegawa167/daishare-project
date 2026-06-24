import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.reservation import ReservationStatus


class MessageCreate(BaseModel):
    body: str


class MessageResponse(BaseModel):
    id: int
    rental_request_id: int
    sender_id: uuid.UUID
    body: str
    is_read: bool
    is_system: bool
    created_at: datetime
    sender_name: str | None = None

    model_config = {"from_attributes": True}


class ReservationResponse(BaseModel):
    id: int
    rental_request_id: int
    lender_id: uuid.UUID
    renter_id: uuid.UUID
    start_date: datetime
    end_date: datetime
    quantity: int
    daily_rate: float
    lent_at: datetime | None
    returned_at: datetime | None
    note: str | None
    status: ReservationStatus
    created_at: datetime
    lender_name: str | None = None
    renter_name: str | None = None
    cart_title: str | None = None
    station_name: str | None = None
    municipality: str | None = None
    lending_address: str | None = None

    model_config = {"from_attributes": True}
