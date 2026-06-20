"""シードデータ投入スクリプト: python -m app.seeds.seed"""
import asyncio

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.line import Line
from app.models.station import Station
from app.seeds.lines_stations import SEED_DATA


async def seed(session: AsyncSession) -> None:
    # 既にデータがあればスキップ
    result = await session.execute(select(Line).limit(1))
    if result.scalar_one_or_none():
        print("Seed data already exists. Skipping.")
        return

    for entry in SEED_DATA:
        line = Line(name=entry["line"])
        session.add(line)
        await session.flush()

        for station_name, municipality in entry["stations"]:
            # 同一路線内で重複する駅名は追加しない
            exists = await session.execute(
                select(Station).where(
                    Station.line_id == line.id,
                    Station.name == station_name,
                )
            )
            if not exists.scalar_one_or_none():
                session.add(Station(name=station_name, municipality=municipality, line_id=line.id))

    await session.commit()
    print("Seed completed.")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
