"""Отзывы, антифрод и trust score."""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timeutils import local_today, utcnow
from app.models import (
    Booking,
    BookingStatus,
    Category,
    Dispute,
    Listing,
    Review,
    User,
    UserRole,
)
from app.services.reviews.fraud import FraudDetector
from app.services.reviews.trust import compute_breakdown, recalculate_trust_score
from tests.helpers import PHOTO_URL, auth

URL = "/api/v1/reviews"
_phone_seq = iter(range(300, 999))


async def _user(session: AsyncSession, *, age_days: int = 60, name: str = "Тест") -> User:
    user = User(phone=f"+992900000{next(_phone_seq):03d}", name=name, verified=True)
    session.add(user)
    await session.flush()
    await session.execute(
        update(User)
        .where(User.id == user.id)
        .values(created_at=utcnow() - timedelta(days=age_days))
    )
    await session.refresh(user)
    return user


async def _deal(
    session: AsyncSession,
    owner: User,
    renter: User,
    *,
    status: BookingStatus = BookingStatus.COMPLETED,
    completed_ago: timedelta = timedelta(hours=1),
    offset: int = 0,
) -> Booking:
    category_id = await session.scalar(select(Category.id).where(Category.slug == "photo"))
    listing = Listing(
        owner_id=owner.id,
        category_id=category_id,
        title="Камера для отзывов",
        price_per_day=Decimal("100"),
        city="Душанбе",
        photos=[PHOTO_URL],
    )
    session.add(listing)
    await session.flush()
    start = local_today() - timedelta(days=40 - offset * 3)
    booking = Booking(
        listing_id=listing.id,
        renter_id=renter.id,
        start_date=start,
        end_date=start + timedelta(days=2),
        total_price=Decimal("200"),
        deposit_amount=Decimal("0"),
        status=status,
        completed_at=utcnow() - completed_ago if status == BookingStatus.COMPLETED else None,
    )
    session.add(booking)
    await session.flush()
    return booking


async def _review(
    client: AsyncClient, author: User, booking: Booking, rating: int = 5, text: str | None = None
) -> Any:
    body = {"booking_id": str(booking.id), "rating": rating, "text": text}
    return await client.post(URL, headers=auth(author), json=body)


async def _set_created(session: AsyncSession, review_id: str, when: datetime) -> None:
    await session.execute(
        update(Review).where(Review.id == uuid.UUID(review_id)).values(created_at=when)
    )
    await session.flush()


async def _score(session: AsyncSession, review_id: str) -> tuple[float, bool]:
    row = (
        await session.execute(
            select(Review.fraud_score, Review.is_hidden).where(Review.id == uuid.UUID(review_id))
        )
    ).one()
    return row[0], row[1]


@pytest.fixture
async def people(db_session: AsyncSession, env: None) -> dict[str, User]:
    return {
        "owner": await _user(db_session, name="Владелец"),
        "renter": await _user(db_session, name="Арендатор"),
        "stranger": await _user(db_session, name="Чужой"),
    }


# --- Создание отзыва -------------------------------------------------------------


async def test_create_review_success(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    booking = await _deal(db_session, people["owner"], people["renter"])
    response = await _review(
        client, people["renter"], booking, 5, "Всё отлично, рекомендую владельца"
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["to_user_id"] == str(people["owner"].id)
    assert body["from_user_id"] == str(people["renter"].id)
    assert body["is_hidden"] is False


async def test_create_review_wrong_status(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    booking = await _deal(
        db_session, people["owner"], people["renter"], status=BookingStatus.PENDING
    )
    assert (await _review(client, people["renter"], booking)).status_code == 403


async def test_create_review_not_participant(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    booking = await _deal(db_session, people["owner"], people["renter"])
    assert (await _review(client, people["stranger"], booking)).status_code == 403


async def test_create_review_duplicate(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    booking = await _deal(db_session, people["owner"], people["renter"])
    assert (await _review(client, people["renter"], booking, 4, "Хорошая вещь")).status_code == 201
    assert (await _review(client, people["renter"], booking, 5)).status_code == 409
    # Вторая сторона сделки отзыв оставить может
    assert (
        await _review(client, people["owner"], booking, 5, "Аккуратный арендатор, спасибо")
    ).status_code == 201


async def test_create_review_after_deadline(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    booking = await _deal(
        db_session, people["owner"], people["renter"], completed_ago=timedelta(days=15)
    )
    assert (await _review(client, people["renter"], booking)).status_code == 403


# --- Антифрод --------------------------------------------------------------------


async def test_fraud_mutual_reviews(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    """Типичная взаимная накрутка: пятёрки-отписки друг другу с разницей 5 минут.

    Само правило взаимности даёт ровно +0.3; «> 0.3» из ТЗ достигается вместе с
    правилом короткого текста (+0.1), которое срабатывает у таких отзывов.
    """
    booking = await _deal(db_session, people["owner"], people["renter"])
    first = (await _review(client, people["renter"], booking, 5, "Супер!")).json()
    await _set_created(db_session, first["id"], utcnow() - timedelta(minutes=5))
    second = (await _review(client, people["owner"], booking, 5, "Спасибо!")).json()

    for review_id in (first["id"], second["id"]):
        score, _ = await _score(db_session, review_id)
        assert score > 0.3
        stored = await db_session.get(Review, uuid.UUID(review_id))
        assert "mutual_reviews" in (await FraudDetector().evaluate(stored, db_session)).rules


async def test_fraud_new_account(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    newbie = await _user(db_session, age_days=3, name="Новичок")
    booking = await _deal(db_session, people["owner"], newbie)
    review = (await _review(client, newbie, booking, 4, "Нормально, без проблем в целом")).json()

    score, _ = await _score(db_session, review["id"])
    assert score >= 0.25
    stored = await db_session.get(Review, uuid.UUID(review["id"]))
    assert "new_account_first_review" in (await FraudDetector().evaluate(stored, db_session)).rules


async def test_fraud_high_score_hidden(
    client: AsyncClient, db_session: AsyncSession, env: None
) -> None:
    # Два свежих аккаунта, взаимные пятёрки без текста сразу после сделки
    a = await _user(db_session, age_days=1, name="А")
    b = await _user(db_session, age_days=1, name="Б")
    booking = await _deal(db_session, a, b, completed_ago=timedelta(seconds=10))

    first = (await _review(client, b, booking, 5)).json()
    second = (await _review(client, a, booking, 5)).json()

    score, hidden = await _score(db_session, second["id"])
    assert score >= 0.7
    assert hidden is True

    public = (await client.get(f"{URL}/user/{b.id}")).json()
    assert second["id"] not in {item["id"] for item in public["items"]}
    assert (await _score(db_session, first["id"]))[1] is True  # встречный тоже скрыт


async def test_fraud_rating_pattern(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    """5 пятёрок одному человеку от аккаунтов, созданных в один день."""
    target = people["owner"]
    review_ids = []
    for i in range(5):
        author = await _user(db_session, age_days=20, name=f"Клон {i}")
        booking = await _deal(db_session, target, author, offset=i + 1)
        review_ids.append(
            (await _review(client, author, booking, 5, "Очень хороший и честный владелец")).json()[
                "id"
            ]
        )

    last = await db_session.get(Review, uuid.UUID(review_ids[-1]))
    assert "rating_pattern" in (await FraudDetector().evaluate(last, db_session)).rules
    assert (await _score(db_session, review_ids[-1]))[0] >= 0.35


# --- Trust score -----------------------------------------------------------------


async def _honest_review(
    session: AsyncSession, author: User, target: User, rating: int, offset: int
) -> None:
    booking = await _deal(session, target, author, completed_ago=timedelta(days=1), offset=offset)
    session.add(
        Review(
            booking_id=booking.id,
            from_user_id=author.id,
            to_user_id=target.id,
            rating=rating,
            text="Всё прошло хорошо, спасибо",
            created_at=utcnow() - timedelta(hours=5),
        )
    )
    await session.flush()


async def test_trust_score_no_reviews(db_session: AsyncSession, people: dict[str, User]) -> None:
    assert await recalculate_trust_score(people["stranger"].id, db_session) == 4.0
    assert people["stranger"].trust_score == Decimal("4.00")


async def test_trust_score_verified_bonus(
    db_session: AsyncSession, people: dict[str, User]
) -> None:
    target = people["owner"]
    await _honest_review(db_session, people["renter"], target, 4, offset=1)
    await _honest_review(db_session, people["stranger"], target, 4, offset=2)

    plain = await compute_breakdown(db_session, target)
    assert plain.base_rating == 4.0
    assert plain.verified_bonus == 0

    target.passport_verified = True
    verified = await compute_breakdown(db_session, target)
    assert verified.verified_bonus == 0.2
    assert verified.final_score == pytest.approx(plain.final_score + 0.2)


async def test_trust_score_dispute_penalty(
    db_session: AsyncSession, people: dict[str, User]
) -> None:
    renter, owner = people["renter"], people["owner"]
    await _honest_review(db_session, owner, renter, 5, offset=1)
    before = await compute_breakdown(db_session, renter)

    disputed = await _deal(db_session, owner, renter, status=BookingStatus.DISPUTED, offset=3)
    db_session.add(Dispute(booking_id=disputed.id, opened_by=owner.id, reason="Сломан объектив"))
    await db_session.flush()

    after = await compute_breakdown(db_session, renter)
    assert after.penalty == pytest.approx(before.penalty + 0.5)
    assert after.final_score == pytest.approx(before.final_score - 0.5)


async def test_trust_score_recalculated_on_review(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    booking = await _deal(db_session, people["owner"], people["renter"])
    await _review(client, people["renter"], booking, 2, "Вещь была грязной и с царапинами")
    await db_session.refresh(people["owner"])
    assert people["owner"].trust_score == Decimal("2.00")


# --- Списки, удаление, аналитика -------------------------------------------------


async def test_user_reviews_distribution_and_listing_reviews(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    owner, renter = people["owner"], people["renter"]
    booking = await _deal(db_session, owner, renter)
    await _review(client, renter, booking, 4, "Хорошая камера, рекомендую всем")
    await _review(client, owner, booking, 5, "Отличный арендатор, всё вернул вовремя")

    about_owner = (await client.get(f"{URL}/user/{owner.id}")).json()
    assert about_owner["total"] == 1
    assert about_owner["avg_rating"] == 4.0
    assert about_owner["rating_distribution"] == {"1": 0, "2": 0, "3": 0, "4": 1, "5": 0}
    assert about_owner["items"][0]["about_role"] == "owner"

    about_renters = (await client.get(f"{URL}/listing/{booking.listing_id}")).json()
    assert [i["author"]["id"] for i in about_renters["items"]] == [str(owner.id)]
    assert about_renters["items"][0]["about_role"] == "renter"


async def test_delete_review_window(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    booking = await _deal(db_session, people["owner"], people["renter"])
    review = (
        await _review(client, people["renter"], booking, 3, "Средне, были мелкие проблемы")
    ).json()

    assert (
        await client.delete(f"{URL}/{review['id']}", headers=auth(people["owner"]))
    ).status_code == 403
    assert (
        await client.delete(f"{URL}/{review['id']}", headers=auth(people["renter"]))
    ).status_code == 204
    assert (await client.get(f"{URL}/user/{people['owner'].id}")).json()["total"] == 0

    other = await _deal(db_session, people["owner"], people["stranger"], offset=2)
    late = (
        await _review(client, people["stranger"], other, 4, "Нормальный владелец, всё хорошо")
    ).json()
    await _set_created(db_session, late["id"], utcnow() - timedelta(hours=25))
    assert (
        await client.delete(f"{URL}/{late['id']}", headers=auth(people["stranger"]))
    ).status_code == 403


async def test_analytics_admin_only(
    client: AsyncClient, db_session: AsyncSession, people: dict[str, User]
) -> None:
    await _deal(db_session, people["owner"], people["renter"])
    url = "/api/v1/analytics/platform"
    assert (await client.get(url, headers=auth(people["renter"]))).status_code == 403

    people["owner"].role = UserRole.ADMIN
    await db_session.flush()
    body = (await client.get(url, headers=auth(people["owner"]))).json()
    assert body["completed_bookings"] >= 1
    assert body["commission_percent"] == 10
    assert Decimal(body["total_revenue"]) >= Decimal("20.00")
    assert any(c["slug"] == "photo" for c in body["top_categories"])
