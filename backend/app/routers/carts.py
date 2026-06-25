import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.cart import Cart, CartLocation, CartStatus
from app.models.station import Station
from app.schemas.cart import CartCreateRequest, CartLocationResponse, CartResponse, CartUpdateRequest

router = APIRouter(prefix="/carts", tags=["carts"])

_EAGER = [
    selectinload(Cart.owner),
    selectinload(Cart.station),
    selectinload(Cart.locations).selectinload(CartLocation.station),
]


async def _get_cart_full(cart_id: int, db: AsyncSession) -> Cart | None:
    result = await db.execute(select(Cart).options(*_EAGER).where(Cart.id == cart_id, Cart.status != CartStatus.deleted))
    return result.scalar_one_or_none()


def _to_response(cart: Cart) -> CartResponse:
    locs = [
        CartLocationResponse(
            id=loc.id,
            station_id=loc.station_id,
            station_name=loc.station.name if loc.station else None,
            municipality=loc.station.municipality if loc.station else None,
            lending_address=loc.lending_address,
        )
        for loc in (cart.locations or [])
    ]
    first = locs[0] if locs else None
    return CartResponse(
        id=cart.id,
        owner_id=cart.owner_id,
        title=cart.title,
        category=cart.category,
        description=cart.description,
        weight_kg=float(cart.weight_kg) if cart.weight_kg is not None else None,
        max_load_kg=float(cart.max_load_kg) if cart.max_load_kg is not None else None,
        width_cm=float(cart.width_cm) if cart.width_cm is not None else None,
        length_cm=float(cart.length_cm) if cart.length_cm is not None else None,
        foldable=cart.foldable,
        daily_rate=float(cart.daily_rate) if cart.daily_rate is not None else None,
        weekly_rate=float(cart.weekly_rate) if cart.weekly_rate is not None else None,
        per_rental_rate=float(cart.per_rental_rate) if cart.per_rental_rate is not None else None,
        quantity=cart.quantity,
        image_urls=cart.image_urls or [],
        # 後方互換: 先頭ロケーションの値をトップレベルに露出
        station_id=first.station_id if first else cart.station_id,
        lending_address=first.lending_address if first else cart.lending_address,
        status=cart.status,
        owner_name=cart.owner.display_name if cart.owner else None,
        station_name=first.station_name if first else (cart.station.name if cart.station else None),
        municipality=first.municipality if first else (cart.station.municipality if cart.station else None),
        locations=locs,
    )


@router.get("", response_model=list[CartResponse])
async def search_carts(
    municipality: str | None = Query(None),
    station_id: int | None = Query(None),
    owner_id: str | None = Query(None),
    category: str | None = Query(None),
    foldable: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[CartResponse]:
    stmt = (
        select(Cart)
        .options(*_EAGER)
        .where(Cart.status == CartStatus.active)
        .order_by(Cart.id.desc())
    )
    if owner_id:
        stmt = stmt.where(Cart.owner_id == uuid.UUID(owner_id))
    elif station_id:
        stmt = stmt.where(Cart.station_id == station_id)
    elif municipality:
        stmt = stmt.join(Station).where(Station.municipality == municipality)
    if category:
        stmt = stmt.where(Cart.category == category)
    if foldable is not None:
        stmt = stmt.where(Cart.foldable == foldable)

    result = await db.execute(stmt)
    return [_to_response(c) for c in result.scalars().all()]


@router.get("/mine", response_model=list[CartResponse])
async def get_my_carts(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[CartResponse]:
    stmt = (
        select(Cart)
        .options(*_EAGER)
        .where(Cart.owner_id == uuid.UUID(user_id), Cart.status != CartStatus.deleted)
        .order_by(Cart.id.asc())
    )
    result = await db.execute(stmt)
    return [_to_response(c) for c in result.scalars().all()]


@router.get("/{cart_id}", response_model=CartResponse)
async def get_cart(cart_id: int, db: AsyncSession = Depends(get_db)) -> CartResponse:
    cart = await _get_cart_full(cart_id, db)
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    return _to_response(cart)


@router.post("", response_model=CartResponse, status_code=status.HTTP_201_CREATED)
async def create_cart(
    body: CartCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> CartResponse:
    data = body.model_dump(exclude={"locations"})
    # locations が送られてきた場合は先頭を station_id / lending_address に反映
    if body.locations:
        data["station_id"] = body.locations[0].station_id
        data["lending_address"] = body.locations[0].lending_address
    cart = Cart(owner_id=uuid.UUID(user_id), **data)
    db.add(cart)
    await db.flush()
    for i, loc in enumerate(body.locations):
        db.add(CartLocation(cart_id=cart.id, station_id=loc.station_id, lending_address=loc.lending_address, sort_order=i))
    await db.commit()
    cart = await _get_cart_full(cart.id, db)
    return _to_response(cart)


@router.put("/{cart_id}", response_model=CartResponse)
async def update_cart(
    cart_id: int,
    body: CartUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> CartResponse:
    cart = await _get_cart_full(cart_id, db)
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    if str(cart.owner_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your cart")

    for field, value in body.model_dump(exclude_none=True, exclude={"locations"}).items():
        setattr(cart, field, value)

    if body.locations is not None:
        # 既存ロケーションを削除して差し替え
        for loc in list(cart.locations):
            await db.delete(loc)
        await db.flush()
        for i, loc in enumerate(body.locations):
            db.add(CartLocation(cart_id=cart.id, station_id=loc.station_id, lending_address=loc.lending_address, sort_order=i))
        if body.locations:
            cart.station_id = body.locations[0].station_id
            cart.lending_address = body.locations[0].lending_address

    await db.commit()
    cart = await _get_cart_full(cart_id, db)
    return _to_response(cart)


@router.patch("/{cart_id}/status", response_model=CartResponse)
async def toggle_cart_status(
    cart_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> CartResponse:
    cart = await _get_cart_full(cart_id, db)
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    if str(cart.owner_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your cart")
    cart.status = CartStatus.inactive if cart.status == CartStatus.active else CartStatus.active
    await db.commit()
    cart = await _get_cart_full(cart_id, db)
    return _to_response(cart)


@router.delete("/{cart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cart(
    cart_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Cart).where(Cart.id == cart_id))
    cart = result.scalar_one_or_none()
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    if str(cart.owner_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your cart")
    cart.status = CartStatus.deleted
    await db.commit()
