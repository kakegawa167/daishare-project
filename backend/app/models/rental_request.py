import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class RequestStatus(PyEnum):
    inquiry = "inquiry"
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    cancelled = "cancelled"


class RentalRequest(Base):
    __tablename__ = "rental_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    cart_id: Mapped[int] = mapped_column(ForeignKey("carts.id"), nullable=False)
    renter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        SAEnum(RequestStatus, name="request_status"), nullable=False, default=RequestStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cart: Mapped["Cart"] = relationship(back_populates="rental_requests")  # noqa: F821
    renter: Mapped["User"] = relationship()  # noqa: F821
