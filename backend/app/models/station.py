from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    municipality: Mapped[str] = mapped_column(String(100), nullable=False)
    line_id: Mapped[int] = mapped_column(ForeignKey("lines.id"), nullable=False)

    line: Mapped["Line"] = relationship(back_populates="stations")  # noqa: F821
    users: Mapped[list["User"]] = relationship(back_populates="base_station")  # noqa: F821
