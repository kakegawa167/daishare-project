import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.message import Message
from app.models.rental_request import RentalRequest
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse
from app.services import notification_service

router = APIRouter(prefix="/rental-requests/{request_id}/messages", tags=["messages"])


async def _check_participant(request_id: int, user_id: str, db: AsyncSession) -> RentalRequest:
    """リクエストの当事者（貸主 or 借主）であることを確認"""
    from app.models.cart import Cart
    result = await db.execute(
        select(RentalRequest).options(selectinload(RentalRequest.cart)).where(RentalRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    uid = uuid.UUID(user_id)
    if req.renter_id != uid and req.cart.owner_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return req


@router.get("", response_model=list[MessageResponse])
async def list_messages(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[MessageResponse]:
    await _check_participant(request_id, user_id, db)
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.rental_request_id == request_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        MessageResponse(
            id=m.id,
            rental_request_id=m.rental_request_id,
            sender_id=m.sender_id,
            body=m.body,
            is_read=m.is_read,
            is_system=m.is_system,
            created_at=m.created_at,
            sender_name=m.sender.display_name if m.sender else None,
        )
        for m in messages
    ]


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    request_id: int,
    body: MessageCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await _check_participant(request_id, user_id, db)
    msg = Message(
        rental_request_id=request_id,
        sender_id=uuid.UUID(user_id),
        body=body.body,
    )
    db.add(msg)
    await db.commit()

    result = await db.execute(
        select(Message).options(selectinload(Message.sender)).where(Message.id == msg.id)
    )
    msg = result.scalar_one()

    # 相手方に通知
    req = await _check_participant(request_id, user_id, db)
    uid = uuid.UUID(user_id)
    recipient_id = req.renter_id if req.cart.owner_id == uid else req.cart.owner_id
    sender_result = await db.execute(select(User).where(User.id == uid))
    sender = sender_result.scalar_one_or_none()
    await notification_service.notify_message_received(
        db, recipient_id, sender.display_name or "相手", request_id
    )
    await db.commit()

    return MessageResponse(
        id=msg.id,
        rental_request_id=msg.rental_request_id,
        sender_id=msg.sender_id,
        body=msg.body,
        is_read=msg.is_read,
        is_system=msg.is_system,
        created_at=msg.created_at,
        sender_name=msg.sender.display_name if msg.sender else None,
    )


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _check_participant(request_id, user_id, db)
    await db.execute(
        update(Message)
        .where(
            Message.rental_request_id == request_id,
            Message.sender_id != uuid.UUID(user_id),
            Message.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    await db.commit()
