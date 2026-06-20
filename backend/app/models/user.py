import uuid
from enum import Enum as PyEnum

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserType(PyEnum):
    lender = "lender"
    renter = "renter"
    both = "both"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_station_id: Mapped[int | None] = mapped_column(ForeignKey("stations.id"), nullable=True)
    lending_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_type: Mapped[UserType] = mapped_column(
        SAEnum(UserType, name="user_type"), nullable=False, default=UserType.renter
    )
    expo_push_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    base_station: Mapped["Station | None"] = relationship(back_populates="users")  # noqa: F821
