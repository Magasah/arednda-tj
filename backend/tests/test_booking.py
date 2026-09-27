"""Бронирование и эскроу: полный жизненный цикл, гонки, автоотмена, штрафы."""

import asyncio
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest
from fakeredis.aioredis import FakeRedis
from httpx import AsyncClient
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionFactory
from app.core.timeutils import local_today, utcnow
from app.models import (
    Booking,
    BookingStatus,
    Category,
    EscrowStatus,
    EscrowTransaction,
    HandoverRecord,
    Listing,
    User,
)
from app.services.booking import service as booking_service
from app.services.booking.schemas import ConfirmReturnRequest
from app.services.escrow.service import EscrowError, EscrowService
from scripts.seed_categories import CATEGORIES
from tests.helpers import FAKE_JPEG, PHOTO_URL, auth, make_user

URL = "/api/v1/bookings"
PHOTO = ("photos", ("item.jpg", FAKE_JPEG, "image/jpeg"))
PRICE, DEPOSIT = Decimal("100.00"), Decimal("500.00")


def _dates(offset: int = 10, days: int = 3) -> dict[str, str]:
    start = local_today() + timedelta(days=offset)
    return {"start_date": start.isoformat(), "end_date": (start + timedelta(days=days)).isoformat()}


async def _listing(session: AsyncSession, owner: User) -> Listing:
    category_id = await session.scalar(select(Category.id).where(Category.slug == "tools"))
    listing = Listing(
        owner_id=owner.id,
        category_id=category_id,
        title="Перфоратор Bosch",
        price_per_day=PRICE,
        deposit_amount=DEPOSIT,
        city="Душанбе",
        photos=[PHOTO_URL],
    )
    session.add(listing)
    await session.flush()
    return listing


@pytest.fixture
async def deal(db_session: AsyncSession, env: None) -> dict[str, Any]:
    owner = await make_user(db_session, "+992900000201", "Владелец")
    renter = await make_user(db_session, "+992900000202", "Арендатор")
    stranger = await make_user(db_session, "+992900000203", "Чужой")
    listing = await _listing(db_session, owner)
    return {"owner": owner, "renter": renter, "stranger": stranger, "listing": listing}


async def _book(client: AsyncClient, deal: dict[str, Any], **dates: Any) -> Any:
    body = {"listing_id": str(deal["listing"].id), **(dates or _dates())}
    return await client.post(URL, headers=auth(deal["renter"]), json=body)


async def _step(client: AsyncClient, deal: dict[str, Any], until: str) -> str:
    """Проводит бронь по сценарию до указанного шага, возвращает booking_id."""
    booking_id = (await _book(client, deal)).json()["booking"]["id"]
    renter = auth(deal["renter"])
    steps = [
        (
            "paid",
            f"{URL}/{booking_id}/confirm-payment",
            renter,
            {"json": {"payment_method": "alif"}},
        ),
        ("active", f"{URL}/{booking_id}/handover", renter, {"files": [PHOTO]}),
        ("returned", f"{URL}/{booking_id}/return", renter, {"files": [PHOTO]}),
    ]
    for name, url, headers, kwargs in steps:
        response = await client.post(url, headers=headers, **kwargs)
        assert response.status_code == 200, response.text
        if name == until:
            break
    return booking_id


# --- Тесты из ТЗ -----------------------------------------------------------------


async def test_create_booking_success(client: AsyncClient, deal: dict[str, Any]) -> None:
    response = await _book(client, deal)
    assert response.status_code == 201, response.text
    body = response.json()
    booking = body["booking"]
    assert booking["status"] == "pending"
    assert booking["days"] == 3
    assert booking["total_price"] == "300.00"
    assert booking["deposit_amount"] == "500.00"
    assert booking["owner_id"] == str(deal["owner"].id)
    assert body["payment_url"].endswith(booking["id"])
    assert body["expires_at"] == booking["payment_expires_at"]


async def test_create_booking_own_listing(client: AsyncClient, deal: dict[str, Any]) -> None:
    body = {"listing_id": str(deal["listing"].id), **_dates()}
    response = await client.post(URL, headers=auth(deal["owner"]), json=body)
    assert response.status_code == 403


@pytest.mark.parametrize(
    "dates",
    [
        {"offset": 0, "days": 2},  # сегодня — нельзя, только с завтра
        {"offset": -3, "days": 2},  # в прошлом
        {"offset": 5, "days": 31},  # больше 30 дней
        {"offset": 5, "days": 0},  # end_date = start_date
    ],
)
async def test_create_booking_past_date(
    client: AsyncClient, deal: dict[str, Any], dates: dict[str, int]
) -> None:
    response = await _book(client, deal, **_dates(**dates))
    assert response.status_code == 422


async def test_create_booking_overlap(
    client: AsyncClient, deal: dict[str, Any], db_session: AsyncSession
) -> None:
    assert (await _book(client, deal, **_dates(10, 3))).status_code == 201

    other = await make_user(db_session, "+992900000204")
    body = {"listing_id": str(deal["listing"].id), **_dates(12, 3)}
    assert (await client.post(URL, headers=auth(other), json=body)).status_code == 409

    # День возврата (10+3) свободен — следующий арендатор может забрать вещь в тот же день
    body = {"listing_id": str(deal["listing"].id), **_dates(13, 2)}
    assert (await client.post(URL, headers=auth(other), json=body)).status_code == 201


async def test_confirm_payment(client: AsyncClient, deal: dict[str, Any]) -> None:
    booking_id = (await _book(client, deal)).json()["booking"]["id"]
    response = await client.post(
        f"{URL}/{booking_id}/confirm-payment",
        headers=auth(deal["renter"]),
        json={"payment_method": "humo"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "payment_frozen"

    detail = (await client.get(f"{URL}/{booking_id}", headers=auth(deal["owner"]))).json()
    escrow = detail["escrow"]
    assert escrow["id"] == response.json()["escrow_id"]
    assert escrow["status"] == "frozen"
    assert escrow["provider"] == "humo"
    assert escrow["provider_tx_id"].startswith("MOCK_")
    assert (escrow["amount"], escrow["deposit"]) == ("300.00", "500.00")

    again = await client.post(
        f"{URL}/{booking_id}/confirm-payment",
        headers=auth(deal["renter"]),
        json={"payment_method": "humo"},
    )
    assert again.status_code == 409


async def test_handover_photos_uploaded(
    client: AsyncClient, deal: dict[str, Any], mock_storage: list[str]
) -> None:
    booking_id = await _step(client, deal, until="active")
    detail = (await client.get(f"{URL}/{booking_id}", headers=auth(deal["renter"]))).json()
    assert detail["status"] == "active"
    assert detail["handover"]["photos_before"] == [PHOTO_URL]
    assert detail["handover"]["handover_at"] is not None
    assert f"handovers/{booking_id}/before" in mock_storage


async def test_return_photos_uploaded(
    client: AsyncClient, deal: dict[str, Any], mock_storage: list[str]
) -> None:
    booking_id = await _step(client, deal, until="active")
    response = await client.post(
        f"{URL}/{booking_id}/return", headers=auth(deal["renter"]), files=[PHOTO, PHOTO]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "return_pending"
    assert body["awaiting_owner_confirmation"] is True
    assert body["penalty_amount"] == "0.00"
    assert f"handovers/{booking_id}/after" in mock_storage


async def test_confirm_return_good(client: AsyncClient, deal: dict[str, Any]) -> None:
    booking_id = await _step(client, deal, until="returned")
    response = await client.post(
        f"{URL}/{booking_id}/confirm-return",
        headers=auth(deal["owner"]),
        json={"condition": "good"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "completed"
    assert body["deposit_returned"] is True
    assert body["payout_amount"] == "300.00"
    assert body["deposit_refund_amount"] == "500.00"

    detail = (await client.get(f"{URL}/{booking_id}", headers=auth(deal["renter"]))).json()
    assert detail["status"] == "completed"
    assert detail["escrow"]["status"] == "released"


async def test_confirm_return_damaged(client: AsyncClient, deal: dict[str, Any]) -> None:
    booking_id = await _step(client, deal, until="returned")
    response = await client.post(
        f"{URL}/{booking_id}/confirm-return",
        headers=auth(deal["owner"]),
        json={"condition": "damaged", "damage_description": "Треснул корпус"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "disputed"
    assert response.json()["deposit_returned"] is False

    dispute = await client.get(f"{URL}/{booking_id}/dispute", headers=auth(deal["renter"]))
    assert dispute.status_code == 200
    assert dispute.json()["status"] == "open"
    assert dispute.json()["reason"] == "Треснул корпус"
    assert dispute.json()["opened_by"] == str(deal["owner"].id)

    detail = (await client.get(f"{URL}/{booking_id}", headers=auth(deal["owner"]))).json()
    assert detail["escrow"]["status"] == "frozen"


async def test_auto_cancel_expired(
    client: AsyncClient, deal: dict[str, Any], db_session: AsyncSession
) -> None:
    booking_id = uuid.UUID((await _book(client, deal)).json()["booking"]["id"])

    # «Мокаем время»: бронь создана 16 минут назад
    await db_session.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(created_at=utcnow() - timedelta(minutes=16))
    )
    await db_session.flush()

    cancelled = await booking_service.cancel_expired_pending(db_session)
    assert booking_id in {b.id for b, _ in cancelled}
    status = await db_session.scalar(select(Booking.status).where(Booking.id == booking_id))
    assert status == BookingStatus.CANCELLED

    # Оплатить отменённую бронь нельзя, а даты снова свободны
    paid = await client.post(
        f"{URL}/{booking_id}/confirm-payment",
        headers=auth(deal["renter"]),
        json={"payment_method": "alif"},
    )
    assert paid.status_code == 409
    assert (await _book(client, deal)).status_code == 201


async def test_create_booking_race_condition(fake_redis: FakeRedis, client: AsyncClient) -> None:
    """Два одновременных запроса на одни даты: реальные транзакции в разных соединениях."""
    suffix = uuid.uuid4().int % 10**6
    async with SessionFactory() as session:
        await session.execute(
            insert(Category).values(CATEGORIES).on_conflict_do_nothing(index_elements=["slug"])
        )
        owner = await make_user(session, f"+99290{suffix:06d}1"[:13], "Гонка-владелец")
        renter_a = await make_user(session, f"+99291{suffix:06d}2"[:13], "Гонка-А")
        renter_b = await make_user(session, f"+99292{suffix:06d}3"[:13], "Гонка-Б")
        listing = await _listing(session, owner)
        await session.commit()
    ids = {"users": [owner.id, renter_a.id, renter_b.id], "listing": listing.id}

    try:
        body = {"listing_id": str(listing.id), **_dates(20, 3)}
        responses = await asyncio.gather(
            client.post(URL, headers=auth(renter_a), json=body),
            client.post(URL, headers=auth(renter_b), json=body),
        )
        assert sorted(r.status_code for r in responses) == [201, 409]

        async with SessionFactory() as session:
            count = await session.scalar(
                select(func.count()).where(Booking.listing_id == listing.id)
            )
        assert count == 1
    finally:
        async with SessionFactory() as session:
            await session.execute(delete(Booking).where(Booking.listing_id == ids["listing"]))
            await session.execute(delete(Listing).where(Listing.id == ids["listing"]))
            await session.execute(delete(User).where(User.id.in_(ids["users"])))
            await session.commit()


# --- Дополнительно ---------------------------------------------------------------


async def test_booking_visible_only_to_participants(
    client: AsyncClient, deal: dict[str, Any]
) -> None:
    booking_id = (await _book(client, deal)).json()["booking"]["id"]
    assert (
        await client.get(f"{URL}/{booking_id}", headers=auth(deal["stranger"]))
    ).status_code == 403

    mine = (await client.get(URL, headers=auth(deal["renter"]))).json()
    assert [b["id"] for b in mine] == [booking_id]
    incoming = (await client.get(URL, headers=auth(deal["owner"]), params={"role": "owner"})).json()
    assert [b["id"] for b in incoming] == [booking_id]


async def test_wrong_actor_and_order(client: AsyncClient, deal: dict[str, Any]) -> None:
    booking_id = (await _book(client, deal)).json()["booking"]["id"]
    # Передача до оплаты — 409; оплата чужим — 403; подтверждение возврата арендатором — 403
    early = await client.post(
        f"{URL}/{booking_id}/handover", headers=auth(deal["renter"]), files=[PHOTO]
    )
    assert early.status_code == 409
    foreign = await client.post(
        f"{URL}/{booking_id}/confirm-payment",
        headers=auth(deal["owner"]),
        json={"payment_method": "alif"},
    )
    assert foreign.status_code == 403
    too_many = await client.post(
        f"{URL}/{booking_id}/handover", headers=auth(deal["renter"]), files=[PHOTO] * 4
    )
    assert too_many.status_code == 422


async def test_late_return_penalty_partial_release(
    client: AsyncClient, deal: dict[str, Any], db_session: AsyncSession
) -> None:
    """Сдали на 2 дня позже: штраф 100 × 2 × 2 = 400 из депозита 500."""
    booking = Booking(
        listing_id=deal["listing"].id,
        renter_id=deal["renter"].id,
        start_date=local_today() - timedelta(days=5),
        end_date=local_today() - timedelta(days=2),
        total_price=Decimal("300.00"),
        deposit_amount=DEPOSIT,
        status=BookingStatus.ACTIVE,
    )
    db_session.add(booking)
    await db_session.flush()
    db_session.add_all(
        [
            HandoverRecord(booking_id=booking.id, photos_before=[PHOTO_URL], handover_at=utcnow()),
            EscrowTransaction(
                booking_id=booking.id, amount=Decimal("300.00"), deposit=DEPOSIT, provider="alif"
            ),
        ]
    )
    await db_session.flush()

    returned = await client.post(
        f"{URL}/{booking.id}/return", headers=auth(deal["renter"]), files=[PHOTO]
    )
    assert returned.status_code == 200, returned.text
    assert (returned.json()["overdue_days"], returned.json()["penalty_amount"]) == (2, "400.00")

    confirmed = await client.post(
        f"{URL}/{booking.id}/confirm-return",
        headers=auth(deal["owner"]),
        json={"condition": "good"},
    )
    body = confirmed.json()
    assert body["status"] == "completed"
    assert (body["payout_amount"], body["deposit_refund_amount"]) == ("700.00", "100.00")
    escrow_status = await db_session.scalar(
        select(EscrowTransaction.status).where(EscrowTransaction.booking_id == booking.id)
    )
    assert escrow_status == EscrowStatus.PARTIAL_RETURNED


async def test_auto_confirm_after_48h(
    client: AsyncClient, deal: dict[str, Any], db_session: AsyncSession
) -> None:
    booking_id = uuid.UUID(await _step(client, deal, until="returned"))
    await db_session.execute(
        update(HandoverRecord)
        .where(HandoverRecord.booking_id == booking_id)
        .values(return_at=utcnow() - timedelta(hours=49))
    )
    await db_session.flush()

    assert booking_id in await booking_service.overdue_return_pending_ids(db_session)
    result = await booking_service.confirm_return(
        db_session, booking_id, None, ConfirmReturnRequest(condition="good")
    )
    assert result.booking.status == BookingStatus.COMPLETED
    assert result.escrow.status == EscrowStatus.RELEASED
    # Повторное автоподтверждение невозможно — статус уже completed
    assert booking_id not in await booking_service.overdue_return_pending_ids(db_session)


async def test_escrow_cannot_release_twice(db_session: AsyncSession, deal: dict[str, Any]) -> None:
    booking = Booking(
        listing_id=deal["listing"].id,
        renter_id=deal["renter"].id,
        start_date=local_today() + timedelta(days=40),
        end_date=local_today() + timedelta(days=42),
        total_price=Decimal("200.00"),
        deposit_amount=DEPOSIT,
        status=BookingStatus.RETURN_PENDING,
    )
    db_session.add(booking)
    await db_session.flush()

    escrow_service = EscrowService(db_session)
    escrow = await escrow_service.freeze(booking.id, Decimal("200.00"), DEPOSIT, "alif")
    await escrow_service.release(escrow.id)
    with pytest.raises(EscrowError):
        await escrow_service.release(escrow.id)
    with pytest.raises(EscrowError):
        await escrow_service.partial_release(escrow.id, Decimal("10"))


def test_penalty_is_capped_by_deposit() -> None:
    end = local_today()
    assert EscrowService.penalty_for(PRICE, end, end, DEPOSIT) == Decimal("0.00")
    assert EscrowService.penalty_for(PRICE, end, end + timedelta(days=1), DEPOSIT) == Decimal(
        "200.00"
    )
    assert EscrowService.penalty_for(PRICE, end, end + timedelta(days=10), DEPOSIT) == DEPOSIT


async def test_damaged_requires_description(client: AsyncClient, deal: dict[str, Any]) -> None:
    booking_id = await _step(client, deal, until="returned")
    response = await client.post(
        f"{URL}/{booking_id}/confirm-return",
        headers=auth(deal["owner"]),
        json={"condition": "damaged"},
    )
    assert response.status_code == 422
    count = await client.get(f"{URL}/{booking_id}/dispute", headers=auth(deal["owner"]))
    assert count.status_code == 404
