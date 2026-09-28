"""Объявления: интеграционные тесты на PostGIS в транзакции с откатом.

Redis — fakeredis, хранилище фото — мок (URL без реальной загрузки).
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models import (
    Booking,
    BookingStatus,
    Category,
    Dispute,
    EscrowTransaction,
    HandoverRecord,
    Listing,
    Review,
    User,
)
from tests.helpers import FAKE_JPEG, PHOTO_URL

URL = "/api/v1/listings"

# Площадь Дусти (Душанбе) и Худжанд (~200 км)
DUSHANBE = (38.5767, 68.7794)
KHUJAND = (40.2833, 69.6333)


async def _user(session: AsyncSession, phone: str, name: str = "Тест") -> User:
    user = User(phone=phone, name=name, verified=True)
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def owner(db_session: AsyncSession, env: None) -> User:
    return await _user(db_session, "+992900000101", "Фаридун")


@pytest.fixture
async def stranger(db_session: AsyncSession, env: None) -> User:
    return await _user(db_session, "+992900000102", "Чужой")


def _auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


async def _create(
    client: AsyncClient,
    user: User,
    *,
    title: str = "Canon EOS R6",
    category: str = "photo",
    city: str = "Душанбе",
    price: str = "150",
    files: list[tuple[str, tuple[str, bytes, str]]] | None = None,
) -> Any:
    return await client.post(
        URL,
        headers=_auth(user),
        data={
            "title": title,
            "category_slug": category,
            "price_per_day": price,
            "deposit_amount": "2000",
            "city": city,
            "lat": str(DUSHANBE[0]),
            "lng": str(DUSHANBE[1]),
        },
        files=files or [("photos", ("photo.jpg", FAKE_JPEG, "image/jpeg"))],
    )


# --- Тесты из ТЗ -----------------------------------------------------------------


async def test_get_categories(client: AsyncClient, env: None) -> None:
    response = await client.get(f"{URL}/categories")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 5
    assert {c["slug"] for c in body} == {"tech", "tools", "transport", "events", "photo"}


async def test_get_listings_empty(client: AsyncClient, db_session: AsyncSession, env: None) -> None:
    # «Пустая БД» внутри транзакции теста — откатится после теста
    for model in (Review, Dispute, HandoverRecord, EscrowTransaction, Booking, Listing):
        await db_session.execute(delete(model))
    await db_session.flush()

    response = await client.get(URL)
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "pages": 0}


async def test_create_listing_unauthorized(client: AsyncClient, env: None) -> None:
    response = await client.post(
        URL,
        data={
            "title": "Камера",
            "category_slug": "photo",
            "price_per_day": "100",
            "city": "Душанбе",
        },
        files=[("photos", ("photo.jpg", FAKE_JPEG, "image/jpeg"))],
    )
    assert response.status_code == 401


async def test_create_listing_success(client: AsyncClient, owner: User) -> None:
    response = await _create(client, owner)
    assert response.status_code == 201, response.text
    body = response.json()
    assert uuid.UUID(body["id"])
    assert body["photos"][0] == PHOTO_URL
    assert body["owner"]["id"] == str(owner.id)
    assert body["price_per_day"] == "150.00"


async def test_create_listing_invalid_photo(client: AsyncClient, owner: User) -> None:
    pdf = [("photos", ("doc.pdf", b"%PDF-1.7\n" + b"\x00" * 100, "application/pdf"))]
    response = await _create(client, owner, files=pdf)
    assert response.status_code == 422


async def test_get_listing_detail(client: AsyncClient, owner: User) -> None:
    listing_id = (await _create(client, owner)).json()["id"]

    response = await client.get(f"{URL}/{listing_id}")
    assert response.status_code == 200
    body = response.json()
    expected = {
        "id", "title", "price_per_day", "deposit_amount", "photos", "rating_avg",
        "rating_count", "city", "category_slug", "is_verified_owner", "owner_id",
        "created_at", "description", "lat", "lng", "status", "owner", "is_available",
        "updated_at",
    }  # fmt: skip
    assert expected <= set(body)
    assert set(body["owner"]) == {
        "id", "name", "avatar_url", "trust_score", "is_verified", "total_deals"
    }  # fmt: skip
    assert body["owner"]["name"] == "Фаридун"
    assert body["is_available"] is True
    assert body["category_slug"] == "photo"


async def test_get_listings_filter_category(client: AsyncClient, owner: User) -> None:
    await _create(client, owner, title="Камера для фильтра", category="photo", city="Тестград")
    await _create(client, owner, title="Дрель для фильтра", category="tools", city="Тестград")

    body = (await client.get(URL, params={"category": "tools", "city": "Тестград"})).json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Дрель для фильтра"
    assert body["items"][0]["category_slug"] == "tools"


async def test_get_listings_filter_city(client: AsyncClient, owner: User) -> None:
    await _create(client, owner, title="В Худжанде", city="Худжанд-тест")
    await _create(client, owner, title="В Душанбе", city="Душанбе-тест")

    body = (await client.get(URL, params={"city": "худжанд-тест"})).json()
    assert [item["title"] for item in body["items"]] == ["В Худжанде"]


async def test_get_listings_search_by_title(client: AsyncClient, owner: User) -> None:
    await _create(client, owner, title="Перфоратор Bosch", city="Поиск-тест")
    await _create(client, owner, title="Камера Canon", city="Поиск-тест")
    await _create(client, owner, title="Скидка 100%", city="Поиск-тест")

    body = (await client.get(URL, params={"q": "  перфОРАТОР ", "city": "Поиск-тест"})).json()
    assert [item["title"] for item in body["items"]] == ["Перфоратор Bosch"]

    # % и _ ищутся как обычные символы, а не как шаблон LIKE
    body = (await client.get(URL, params={"q": "%", "city": "Поиск-тест"})).json()
    assert [item["title"] for item in body["items"]] == ["Скидка 100%"]


async def test_patch_listing_owner(client: AsyncClient, owner: User) -> None:
    listing_id = (await _create(client, owner)).json()["id"]
    await client.get(f"{URL}/{listing_id}")  # прогреваем кэш карточки

    response = await client.patch(
        f"{URL}/{listing_id}", headers=_auth(owner), json={"price_per_day": "120"}
    )
    assert response.status_code == 200
    assert response.json()["price_per_day"] == "120.00"
    # Кэш инвалидирован — GET отдаёт новую цену
    assert (await client.get(f"{URL}/{listing_id}")).json()["price_per_day"] == "120.00"


async def test_patch_listing_not_owner(client: AsyncClient, owner: User, stranger: User) -> None:
    listing_id = (await _create(client, owner)).json()["id"]
    response = await client.patch(
        f"{URL}/{listing_id}", headers=_auth(stranger), json={"price_per_day": "1"}
    )
    assert response.status_code == 403


async def test_delete_listing(client: AsyncClient, owner: User) -> None:
    listing_id = (await _create(client, owner)).json()["id"]
    await client.get(f"{URL}/{listing_id}")

    response = await client.delete(f"{URL}/{listing_id}", headers=_auth(owner))
    assert response.status_code == 204

    detail = (await client.get(f"{URL}/{listing_id}")).json()
    assert detail["status"] == "inactive"
    assert detail["is_available"] is False
    feed = (await client.get(URL, params={"city": "Душанбе"})).json()
    assert listing_id not in {item["id"] for item in feed["items"]}


async def test_get_user_profile(client: AsyncClient, owner: User) -> None:
    listing_id = (await _create(client, owner)).json()["id"]

    response = await client.get(f"/api/v1/users/{owner.id}/profile")
    assert response.status_code == 200
    body = response.json()
    assert "phone" not in body["user"]
    assert body["stats"] == {"total_deals": 0, "disputes": 0, "return_rate_percent": None}
    assert [item["id"] for item in body["active_listings"]] == [listing_id]
    assert body["recent_reviews"] == []

    assert (await client.get(f"/api/v1/users/{uuid.uuid7()}/profile")).status_code == 404


# --- Дополнительно: геопоиск, даты, аренда, фото ---------------------------------


@pytest.fixture
async def geo_data(db_session: AsyncSession, owner: User) -> dict[str, Listing]:
    category_id = await db_session.scalar(select(Category.id).where(Category.slug == "photo"))
    assert category_id is not None

    def listing(title: str, city: str, coords: tuple[float, float]) -> Listing:
        return Listing(
            owner_id=owner.id,
            category_id=category_id,
            title=title,
            price_per_day=Decimal("100"),
            city=city,
            lat=coords[0],
            lng=coords[1],
            photos=[PHOTO_URL],
        )

    near = listing("Рядом", "Гео-тест", DUSHANBE)
    far = listing("Далеко", "Гео-тест", KHUJAND)
    db_session.add_all([near, far])
    await db_session.flush()

    db_session.add(
        Booking(
            listing_id=near.id,
            renter_id=owner.id,
            start_date=date(2031, 10, 1),
            end_date=date(2031, 10, 5),
            total_price=Decimal("500"),
            deposit_amount=Decimal("0"),
            status=BookingStatus.PAYMENT_FROZEN,
        )
    )
    await db_session.flush()
    return {"near": near, "far": far}


async def test_geo_filter_radius(client: AsyncClient, geo_data: dict[str, Listing]) -> None:
    params = {"city": "Гео-тест", "lat": DUSHANBE[0], "lng": DUSHANBE[1], "radius": 5}
    body = (await client.get(URL, params=params)).json()
    assert [item["title"] for item in body["items"]] == ["Рядом"]


async def test_dates_filter_hides_booked(client: AsyncClient, geo_data: dict[str, Listing]) -> None:
    params = {"city": "Гео-тест", "date_from": "2031-10-04", "date_to": "2031-10-07"}
    assert [i["title"] for i in (await client.get(URL, params=params)).json()["items"]] == [
        "Далеко"
    ]
    # 5 октября — день возврата: вещь уже свободна
    params = {"city": "Гео-тест", "date_from": "2031-10-05", "date_to": "2031-10-07"}
    assert (await client.get(URL, params=params)).json()["total"] == 2


async def test_price_filter_and_pagination(client: AsyncClient, owner: User) -> None:
    for i, price in enumerate(["50", "150", "250"]):
        await _create(client, owner, title=f"Цена {i}", price=price, city="Цено-тест")

    body = (
        await client.get(URL, params={"city": "Цено-тест", "min_price": 100, "max_price": 300})
    ).json()
    assert body["total"] == 2

    page2 = (await client.get(URL, params={"city": "Цено-тест", "limit": 2, "page": 2})).json()
    assert (page2["total"], page2["page"], page2["pages"], len(page2["items"])) == (3, 2, 2, 1)


async def test_cannot_edit_during_active_rental(
    client: AsyncClient, geo_data: dict[str, Listing], owner: User
) -> None:
    listing_id = geo_data["near"].id
    patch = await client.patch(f"{URL}/{listing_id}", headers=_auth(owner), json={"title": "Нов"})
    assert patch.status_code == 409
    assert (await client.delete(f"{URL}/{listing_id}", headers=_auth(owner))).status_code == 409


async def test_photos_add_limit_and_remove(client: AsyncClient, owner: User) -> None:
    listing_id = (await _create(client, owner)).json()["id"]
    photo = ("files", ("p.jpg", FAKE_JPEG, "image/jpeg"))

    added = await client.post(
        f"{URL}/{listing_id}/photos", headers=_auth(owner), files=[photo, photo]
    )
    assert added.status_code == 200
    assert len(added.json()["photos"]) == 3

    too_many = await client.post(
        f"{URL}/{listing_id}/photos", headers=_auth(owner), files=[photo] * 6
    )
    assert too_many.status_code == 422

    removed = await client.delete(f"{URL}/{listing_id}/photos/0", headers=_auth(owner))
    assert removed.status_code == 200
    assert len(removed.json()["photos"]) == 2
    missing = await client.delete(f"{URL}/{listing_id}/photos/9", headers=_auth(owner))
    assert missing.status_code == 404


async def test_db_forbids_overlapping_bookings(
    db_session: AsyncSession, geo_data: dict[str, Listing], owner: User
) -> None:
    db_session.add(
        Booking(
            listing_id=geo_data["near"].id,
            renter_id=owner.id,
            start_date=date(2031, 10, 4),
            end_date=date(2031, 10, 6),
            total_price=Decimal("200"),
            deposit_amount=Decimal("0"),
        )
    )
    with pytest.raises(IntegrityError, match="ex_bookings_no_overlap"):
        await db_session.flush()


# --- Кабинет владельца и календарь бронирования --------------------------------------


async def test_busy_dates_for_calendar(client: AsyncClient, geo_data: dict[str, Listing]) -> None:
    busy = (await client.get(f"{URL}/{geo_data['near'].id}/busy-dates")).json()
    assert busy == [{"start_date": "2031-10-01", "end_date": "2031-10-05"}]
    assert (await client.get(f"{URL}/{geo_data['far'].id}/busy-dates")).json() == []


async def test_filter_by_owner(client: AsyncClient, owner: User, stranger: User) -> None:
    await _create(client, owner, title="Вещь владельца", city="Владелец-тест")
    await _create(client, stranger, title="Чужая вещь", city="Владелец-тест")

    params = {"city": "Владелец-тест", "owner_id": str(owner.id)}
    body = (await client.get(URL, params=params)).json()
    assert [item["title"] for item in body["items"]] == ["Вещь владельца"]


async def test_my_listings_hidden_vs_deleted(client: AsyncClient, owner: User) -> None:
    visible = (await _create(client, owner, title="Видимая")).json()["id"]
    hidden = (await _create(client, owner, title="Скрытая")).json()["id"]
    deleted = (await _create(client, owner, title="Удалённая")).json()["id"]

    patch = await client.patch(f"{URL}/{hidden}", headers=_auth(owner), json={"status": "inactive"})
    assert patch.status_code == 200
    assert (await client.delete(f"{URL}/{deleted}", headers=_auth(owner))).status_code == 204

    mine = (await client.get("/api/v1/users/me/listings", headers=_auth(owner))).json()
    by_id = {item["id"]: item["status"] for item in mine}
    assert by_id[visible] == "active"
    assert by_id[hidden] == "inactive"  # скрытое остаётся в кабинете — его можно вернуть
    assert deleted not in by_id

    # Скрытое возвращается в ленту, удалённое больше не редактируется
    back = await client.patch(f"{URL}/{hidden}", headers=_auth(owner), json={"status": "active"})
    assert back.status_code == 200
    gone = await client.patch(f"{URL}/{deleted}", headers=_auth(owner), json={"status": "active"})
    assert gone.status_code == 404


async def test_my_listings_requires_auth(client: AsyncClient, env: None) -> None:
    assert (await client.get("/api/v1/users/me/listings")).status_code == 401
