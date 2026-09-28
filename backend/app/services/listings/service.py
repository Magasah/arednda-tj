"""Бизнес-логика объявлений: лента, карточка, CRUD, фото, профиль пользователя."""

import math
import uuid
from datetime import date, timedelta
from typing import Any

from fastapi import HTTPException, UploadFile, status
from geoalchemy2 import Geography
from sqlalchemy import Select, and_, cast, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.storage import StorageService
from app.core.timeutils import local_today, utcnow
from app.models import Booking, Category, Listing, ListingStatus, Review, User
from app.models.booking import HOLDING_STATUSES, IN_PROGRESS_STATUSES
from app.services.listings.schemas import (
    BusyPeriod,
    ListingCard,
    ListingCreate,
    ListingDetail,
    ListingFilters,
    ListingPage,
    ListingUpdate,
    MyListing,
    UserShort,
)
from app.services.users import stats

CARD_PHOTOS = 2


# --- Общие подзапросы ------------------------------------------------------------


def _rating_subquery() -> Any:
    """Рейтинг вещи: оценки арендаторов по броням этого объявления."""
    return (
        select(
            Booking.listing_id.label("listing_id"),
            func.avg(Review.rating).label("rating_avg"),
            func.count(Review.id).label("rating_count"),
        )
        .join(
            Review,
            and_(Review.booking_id == Booking.id, Review.from_user_id == Booking.renter_id),
        )
        .group_by(Booking.listing_id)
        .subquery()
    )


def card_query() -> Select[Any]:
    rating = _rating_subquery()
    return (
        select(
            Listing,
            Category.slug.label("category_slug"),
            User.passport_verified.label("owner_verified"),
            rating.c.rating_avg,
            rating.c.rating_count,
        )
        .join(Category, Category.id == Listing.category_id)
        .join(User, User.id == Listing.owner_id)
        .outerjoin(rating, rating.c.listing_id == Listing.id)
    )


def card_fields(row: Any, photos_limit: int | None = CARD_PHOTOS) -> dict[str, Any]:
    listing: Listing = row.Listing
    return {
        "id": listing.id,
        "title": listing.title,
        "price_per_day": listing.price_per_day,
        "deposit_amount": listing.deposit_amount,
        "photos": listing.photos[:photos_limit] if photos_limit else list(listing.photos),
        "rating_avg": round(float(row.rating_avg), 2) if row.rating_avg is not None else None,
        "rating_count": row.rating_count or 0,
        "city": listing.city,
        "category_slug": row.category_slug,
        "is_verified_owner": row.owner_verified,
        "owner_id": listing.owner_id,
        "created_at": listing.created_at,
    }


def _busy_between(date_from: date, date_to: date) -> Any:
    """Есть бронь, удерживающая даты в периоде [date_from, date_to).

    Та же семантика, что у ex_bookings_no_overlap: день возврата свободен.
    """
    return exists().where(
        Booking.listing_id == Listing.id,
        Booking.status.in_(HOLDING_STATUSES),
        func.daterange(Booking.start_date, Booking.end_date, "[)").op("&&")(
            func.daterange(date_from, date_to, "[)")
        ),
    )


def _point(lat: float, lng: float) -> Any:
    return cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), Geography(srid=4326))


# --- Лента -----------------------------------------------------------------------


async def list_listings(session: AsyncSession, filters: ListingFilters) -> ListingPage:
    query = card_query().where(Listing.status == ListingStatus.ACTIVE)

    if filters.q and filters.q.strip():
        # Экранируем % и _: пользовательский ввод — подстрока, а не шаблон LIKE
        pattern = filters.q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Listing.title.ilike(f"%{pattern}%", escape="\\"))
    if filters.category:
        query = query.where(Category.slug == filters.category)
    if filters.owner_id:
        query = query.where(Listing.owner_id == filters.owner_id)
    if filters.city:
        query = query.where(func.lower(Listing.city) == filters.city.strip().lower())
    if filters.min_price is not None:
        query = query.where(Listing.price_per_day >= filters.min_price)
    if filters.max_price is not None:
        query = query.where(Listing.price_per_day <= filters.max_price)
    if filters.lat is not None and filters.lng is not None:
        # ST_DWithin по geography — расстояние в метрах, работает GIST-индекс
        point = _point(filters.lat, filters.lng)
        query = query.where(func.ST_DWithin(Listing.location, point, filters.radius * 1000))
    if filters.date_from and filters.date_to:
        query = query.where(~_busy_between(filters.date_from, filters.date_to))

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.execute(
        query.order_by(Listing.created_at.desc(), Listing.id.desc())
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit)
    )
    return ListingPage(
        items=[ListingCard(**card_fields(row)) for row in rows],
        total=total,
        page=filters.page,
        pages=math.ceil(total / filters.limit) if total else 0,
    )


# --- Карточка --------------------------------------------------------------------


async def user_short(session: AsyncSession, user: User) -> UserShort:
    return UserShort(
        id=user.id,
        name=user.name,
        avatar_url=user.avatar_url,
        trust_score=user.trust_score,
        is_verified=user.passport_verified,
        total_deals=await stats.total_deals(session, user.id),
    )


async def get_listing_detail(session: AsyncSession, listing_id: uuid.UUID) -> ListingDetail | None:
    row = (await session.execute(card_query().where(Listing.id == listing_id))).first()
    if row is None:
        return None

    listing: Listing = row.Listing
    owner = await session.get(User, listing.owner_id)
    if owner is None:
        return None
    today = date.today()
    busy_today = await session.scalar(
        select(_busy_between(today, today + timedelta(days=1))).where(Listing.id == listing.id)
    )

    return ListingDetail(
        **card_fields(row, photos_limit=None),
        description=listing.description,
        lat=listing.lat,
        lng=listing.lng,
        status=listing.status,
        owner=await user_short(session, owner),
        is_available=listing.status == ListingStatus.ACTIVE and not busy_today,
        updated_at=listing.updated_at,
    )


# --- Создание и изменение --------------------------------------------------------


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail)


async def _category_id(session: AsyncSession, slug: str) -> int:
    category_id = await session.scalar(select(Category.id).where(Category.slug == slug))
    if category_id is None:
        raise _unprocessable(f"Категория {slug!r} не найдена")
    return category_id


def _check_photos_count(count: int) -> None:
    if not 1 <= count <= settings.listing_max_photos:
        raise _unprocessable(f"Нужно от 1 до {settings.listing_max_photos} фото, передано {count}")


async def create_listing(
    session: AsyncSession,
    storage: StorageService,
    owner: User,
    data: ListingCreate,
    photos: list[UploadFile],
) -> uuid.UUID:
    _check_photos_count(len(photos))
    category_id = await _category_id(session, data.category_slug)

    # id заранее — фото сразу кладутся в папку listings/{id}/
    listing_id = uuid.uuid7()
    urls = await storage.upload_many(photos, f"listings/{listing_id}")

    session.add(
        Listing(
            id=listing_id,
            owner_id=owner.id,
            category_id=category_id,
            title=data.title.strip(),
            description=data.description,
            price_per_day=data.price_per_day,
            deposit_amount=data.deposit_amount,
            city=data.city.strip(),
            lat=data.lat,
            lng=data.lng,
            photos=urls,
        )
    )
    try:
        await session.commit()
    except Exception:
        # Объявление не создано — фото не должны остаться сиротами
        await session.rollback()
        for url in urls:
            await storage.delete_file(url)
        raise
    return listing_id


async def get_owned_listing(
    session: AsyncSession, listing_id: uuid.UUID, user: User, *, for_update: bool = False
) -> Listing:
    query = select(Listing).where(Listing.id == listing_id)
    if for_update:
        # Блокировка строки: параллельные правки (например, фото) не затрут друг друга
        query = query.with_for_update()
    listing = await session.scalar(query)
    if listing is None or listing.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Объявление не найдено")
    if listing.owner_id != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Объявление принадлежит другому пользователю"
        )
    return listing


async def _ensure_no_active_rental(session: AsyncSession, listing: Listing) -> None:
    active = await session.scalar(
        select(
            exists().where(
                Booking.listing_id == listing.id, Booking.status.in_(IN_PROGRESS_STATUSES)
            )
        )
    )
    if active:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "По объявлению идёт аренда — изменить или удалить его нельзя"
        )


_NOT_NULL_FIELDS = ("title", "category_slug", "price_per_day", "deposit_amount", "city", "photos")


async def update_listing(
    session: AsyncSession, listing_id: uuid.UUID, user: User, data: ListingUpdate
) -> None:
    listing = await get_owned_listing(session, listing_id, user, for_update=True)
    await _ensure_no_active_rental(session, listing)

    changes = data.model_dump(exclude_unset=True)
    for field in _NOT_NULL_FIELDS:
        if field in changes and changes[field] is None:
            raise _unprocessable(f"{field} не может быть null")

    if "category_slug" in changes:
        listing.category_id = await _category_id(session, changes.pop("category_slug"))
    if "status" in changes:
        listing.status = ListingStatus(changes.pop("status"))
    if "photos" in changes:
        order = changes.pop("photos")
        # Только перестановка: чужой URL подставить нельзя, фото не теряются
        if sorted(order) != sorted(listing.photos):
            raise _unprocessable("photos: нужен тот же набор фото в новом порядке")
        listing.photos = order
    for field, value in changes.items():
        setattr(listing, field, value.strip() if field in ("title", "city") else value)

    await session.commit()


async def delete_listing(session: AsyncSession, listing_id: uuid.UUID, user: User) -> None:
    listing = await get_owned_listing(session, listing_id, user, for_update=True)
    await _ensure_no_active_rental(session, listing)
    # Мягкое удаление: история сделок и фото сохраняются, в кабинете объявления больше нет
    listing.status = ListingStatus.INACTIVE
    listing.deleted_at = utcnow()
    await session.commit()


async def my_listings(session: AsyncSession, user: User) -> list[MyListing]:
    """Все объявления владельца, кроме удалённых: активные, скрытые и сданные."""
    rows = await session.execute(
        card_query()
        .where(Listing.owner_id == user.id, Listing.deleted_at.is_(None))
        .order_by(Listing.created_at.desc(), Listing.id.desc())
    )
    return [
        MyListing(**card_fields(row), status=row.Listing.status, updated_at=row.Listing.updated_at)
        for row in rows
    ]


async def busy_periods(session: AsyncSession, listing_id: uuid.UUID) -> list[BusyPeriod]:
    """Будущие занятые периоды вещи — для календаря бронирования (день возврата свободен)."""
    rows = await session.execute(
        select(Booking.start_date, Booking.end_date)
        .where(
            Booking.listing_id == listing_id,
            Booking.status.in_(HOLDING_STATUSES),
            Booking.end_date > local_today(),
        )
        .order_by(Booking.start_date)
    )
    return [BusyPeriod(start_date=start, end_date=end) for start, end in rows]


async def add_photos(
    session: AsyncSession,
    storage: StorageService,
    listing_id: uuid.UUID,
    user: User,
    files: list[UploadFile],
) -> None:
    listing = await get_owned_listing(session, listing_id, user, for_update=True)
    if not files:
        raise _unprocessable("Не передано ни одного фото")
    if len(listing.photos) + len(files) > settings.listing_max_photos:
        raise _unprocessable(
            f"Не больше {settings.listing_max_photos} фото: уже загружено {len(listing.photos)}"
        )
    urls = await storage.upload_many(files, f"listings/{listing.id}")
    listing.photos = [*listing.photos, *urls]
    await session.commit()


async def remove_photo(
    session: AsyncSession,
    storage: StorageService,
    listing_id: uuid.UUID,
    user: User,
    index: int,
) -> None:
    listing = await get_owned_listing(session, listing_id, user, for_update=True)
    if not 0 <= index < len(listing.photos):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Фото с индексом {index} нет")
    if len(listing.photos) == 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "Нельзя удалить единственное фото")

    url = listing.photos[index]
    listing.photos = [p for i, p in enumerate(listing.photos) if i != index]
    await session.commit()
    await storage.delete_file(url)


async def list_categories(session: AsyncSession) -> list[Category]:
    return list(await session.scalars(select(Category).order_by(Category.id)))
