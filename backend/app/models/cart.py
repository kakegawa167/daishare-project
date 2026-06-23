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


class CartCategory(PyEnum):
    hand_truck = "hand_truck"       # 手押し台車
    flat_cart = "flat_cart"         # 平台車
    hand_dolly = "hand_dolly"       # ハンドトラック
    outdoor_wagon = "outdoor_wagon" # アウトドアワゴン
    other = "other"                 # その他


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[CartCategory | None] = mapped_column(
        SAEnum(CartCategory, name="cart_category"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # スペック
    weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    max_load_kg: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    width_cm: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    length_cm: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    foldable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 価格（少なくとも1つ必須はアプリ側で制御）
    daily_rate: Mapped[float | None] = mapped_column(Numeric(10, 0), nullable=True)
    weekly_rate: Mapped[float | None] = mapped_column(Numeric(10, 0), nullable=True)
    per_rental_rate: Mapped[float | None] = mapped_column(Numeric(10, 0), nullable=True)

    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    image_urls: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("stations.id"), nullable=True)
    lending_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CartStatus] = mapped_column(
        SAEnum(CartStatus, name="cart_status"), nullable=False, default=CartStatus.active
    )

    owner: Mapped["User"] = relationship()  # noqa: F821
    station: Mapped["Station | None"] = relationship()  # noqa: F821
    rental_requests: Mapped[list["RentalRequest"]] = relationship(back_populates="cart")  # noqa: F821
