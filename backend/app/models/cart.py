import uuid
from enum import Enum as PyEnum

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CartStatus(PyEnum):
    active = "active"
    inactive = "inactive"
    deleted = "deleted"


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    daily_rate: Mapped[float] = mapped_column(Numeric(10, 0), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    image_urls: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("stations.id"), nullable=True)
    status: Mapped[CartStatus] = mapped_column(
        SAEnum(CartStatus, name="cart_status"), nullable=False, default=CartStatus.active
    )

    owner: Mapped["User"] = relationship()  # noqa: F821
    station: Mapped["Station | None"] = relationship()  # noqa: F821
    rental_requests: Mapped[list["RentalRequest"]] = relationship(back_populates="cart")  # noqa: F821
