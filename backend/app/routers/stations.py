from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.line import Line
from app.models.station import Station
from app.schemas.station import LineResponse, StationResponse

router = APIRouter(tags=["stations"])


@router.get("/lines", response_model=list[LineResponse])
async def get_lines(db: AsyncSession = Depends(get_db)) -> list[Line]:
    result = await db.execute(select(Line).order_by(Line.id))
    return list(result.scalars().all())


@router.get("/stations", response_model=list[StationResponse])
async def get_stations(
    municipality: str | None = Query(None),
    line_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[StationResponse]:
    stmt = select(Station).options(selectinload(Station.line)).order_by(Station.id)
    if municipality:
        stmt = stmt.where(Station.municipality == municipality)
    if line_id:
        stmt = stmt.where(Station.line_id == line_id)

    result = await db.execute(stmt)
    stations = result.scalars().all()
    return [
        StationResponse(
            id=s.id,
            name=s.name,
            municipality=s.municipality,
            line_id=s.line_id,
            line_name=s.line.name,
        )
        for s in stations
    ]


@router.get("/stations/municipalities", response_model=list[str])
async def get_municipalities(db: AsyncSession = Depends(get_db)) -> list[str]:
    result = await db.execute(
        select(Station.municipality).distinct().order_by(Station.municipality)
    )
    return list(result.scalars().all())
