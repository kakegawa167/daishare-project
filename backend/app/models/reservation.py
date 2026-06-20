import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ReservationStatus(PyEnum):
    reserved = "reserved"
    lent = "lent"
    returned = "returned"
    cancelled = "cancelled"


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True)
    rental_request_id: Mapped[int] = mapped_column(ForeignKey("rental_requests.id"), nullable=False, unique=True)
    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    renter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    daily_rate: Mapped[float] = mapped_column(Numeric(10, 0), nullable=False)
    lent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReservationStatus] = mapped_column(
        SAEnum(ReservationStatus, name="reservation_status"),
        nullable=False,
        default=ReservationStatus.reserved,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    rental_request: Mapped["RentalRequest"] = relationship()  # noqa: F821
    lender: Mapped["User"] = relationship(foreign_keys=[lender_id])  # noqa: F821
    renter: Mapped["User"] = relationship(foreign_keys=[renter_id])  # noqa: F821
    reservation_carts: Mapped[list["ReservationCart"]] = relationship(back_populates="reservation")


class ReservationCart(Base):
    __tablename__ = "reservation_carts"

    id: Mapped[int] = mapped_column(primary_key=True)
    reservation_id: Mapped[int] = mapped_column(ForeignKey("reservations.id"), nullable=False)
    cart_id: Mapped[int] = mapped_column(ForeignKey("carts.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reservation: Mapped["Reservation"] = relationship(back_populates="reservation_carts")
    cart: Mapped["Cart"] = relationship()  # noqa: F821
