import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Path, Query, Response, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.core.cache import CATEGORIES_KEY, CATEGORIES_TTL, LISTING_TTL, CacheDep, listing_key
from app.core.database import SessionDep
from app.core.security import CurrentUser
from app.core.storage import StorageDep
from app.services.listings import service
from app.services.listings.schemas import (
    BusyPeriod,
    CategoryRead,
    ListingCreate,
    ListingDetail,
    ListingFilters,
    ListingPage,
    ListingUpdate,
)

router = APIRouter(prefix="/listings", tags=["Listings"])

PhotosField = Annotated[
    list[UploadFile],
    File(
        description="JPEG / PNG / WebP, до 10 МБ каждый, всего не больше 8",
        # format: binary — чтобы Swagger UI показал выбор файлов (OpenAPI 3.1 даёт
        # только contentMediaType, который Swagger для массивов не понимает)
        json_schema_extra={"items": {"type": "string", "format": "binary"}},
    ),
]


async def _detail_or_404(session: SessionDep, listing_id: uuid.UUID) -> ListingDetail:
    detail = await service.get_listing_detail(session, listing_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Объявление не найдено")
    return detail


@router.get(
    "",
    response_model=ListingPage,
    summary="Лента объявлений",
    description=(
        "Активные объявления с фильтрами: категория (slug), город, цена, "
        "геопоиск (lat + lng + radius км, PostGIS ST_DWithin) и свободные даты — "
        "вещи с бронью на пересекающийся период исключаются."
    ),
    response_description="Страница карточек и пагинация",
)
async def list_listings(
    session: SessionDep, filters: Annotated[ListingFilters, Query()]
) -> ListingPage:
    return await service.list_listings(session, filters)


@router.get(
    "/categories",
    response_model=list[CategoryRead],
    summary="Категории вещей",
    description="Все категории. Кэш в Redis на 1 час (ключ categories:all).",
    response_description="Список категорий",
)
async def list_categories(session: SessionDep, cache: CacheDep) -> list[CategoryRead]:
    cached = await cache.get(CATEGORIES_KEY)
    if cached is not None:
        return [CategoryRead.model_validate(item) for item in cached]

    categories = [CategoryRead.model_validate(c) for c in await service.list_categories(session)]
    await cache.set(CATEGORIES_KEY, [c.model_dump(mode="json") for c in categories], CATEGORIES_TTL)
    return categories


@router.get(
    "/{listing_id}",
    response_model=ListingDetail,
    summary="Карточка объявления",
    description="Все фото, координаты, профиль владельца и доступность на сегодня. Кэш 5 минут.",
    response_description="Полные данные объявления",
)
async def get_listing(listing_id: uuid.UUID, session: SessionDep, cache: CacheDep) -> ListingDetail:
    key = listing_key(listing_id)
    cached = await cache.get(key)
    if cached is not None:
        return ListingDetail.model_validate(cached)

    detail = await _detail_or_404(session, listing_id)
    await cache.set(key, detail.model_dump(mode="json"), LISTING_TTL)
    return detail


@router.get(
    "/{listing_id}/busy-dates",
    response_model=list[BusyPeriod],
    summary="Занятые даты",
    description=(
        "Будущие периоды [start_date, end_date), занятые бронями (ждёт оплаты, оплачено, "
        "в аренде, возврат). День end_date свободен — с него можно бронировать."
    ),
    response_description="Занятые периоды по возрастанию start_date",
)
async def busy_dates(listing_id: uuid.UUID, session: SessionDep) -> list[BusyPeriod]:
    return await service.busy_periods(session, listing_id)


@router.post(
    "",
    response_model=ListingDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Создать объявление",
    description=(
        "multipart/form-data: поля объявления + photos (1–8 файлов JPEG/PNG/WebP, до 10 МБ). "
        "Фото сохраняются в MinIO (на dev без MinIO — в backend/uploads)."
    ),
    response_description="Созданное объявление",
)
async def create_listing(
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    title: Annotated[str, Form(min_length=3, max_length=100, examples=["Canon EOS R6"])],
    category_slug: Annotated[str, Form(examples=["photo"])],
    price_per_day: Annotated[Decimal, Form(gt=0, examples=["150"])],
    city: Annotated[str, Form(min_length=2, max_length=80, examples=["Душанбе"])],
    photos: PhotosField,
    description: Annotated[str | None, Form(max_length=2000)] = None,
    deposit_amount: Annotated[Decimal, Form(ge=0, examples=["2000"])] = Decimal("0"),
    lat: Annotated[float | None, Form(ge=-90, le=90, examples=[38.5767])] = None,
    lng: Annotated[float | None, Form(ge=-180, le=180, examples=[68.7794])] = None,
) -> ListingDetail:
    try:
        data = ListingCreate(
            title=title,
            description=description,
            category_slug=category_slug,
            price_per_day=price_per_day,
            deposit_amount=deposit_amount,
            city=city,
            lat=lat,
            lng=lng,
        )
    except ValidationError as exc:
        # Тот же формат 422, что и у остальных эндпоинтов
        raise RequestValidationError(exc.errors(include_url=False)) from exc
    listing_id = await service.create_listing(session, storage, user, data, photos)
    return await _detail_or_404(session, listing_id)


@router.patch(
    "/{listing_id}",
    response_model=ListingDetail,
    summary="Изменить объявление",
    description="Только владелец. Нельзя, пока идёт аренда (409). Фото — отдельными эндпоинтами.",
    response_description="Обновлённое объявление",
)
async def update_listing(
    listing_id: uuid.UUID,
    data: ListingUpdate,
    user: CurrentUser,
    session: SessionDep,
    cache: CacheDep,
) -> ListingDetail:
    await service.update_listing(session, listing_id, user, data)
    await cache.delete(listing_key(listing_id))
    return await _detail_or_404(session, listing_id)


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Снять объявление",
    description="Мягкое удаление (status=inactive). Только владелец, не во время аренды.",
    response_description="Объявление снято",
)
async def delete_listing(
    listing_id: uuid.UUID, user: CurrentUser, session: SessionDep, cache: CacheDep
) -> Response:
    await service.delete_listing(session, listing_id, user)
    await cache.delete(listing_key(listing_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{listing_id}/photos",
    response_model=ListingDetail,
    summary="Добавить фото",
    description="Только владелец. Всего у объявления не больше 8 фото.",
    response_description="Объявление с новыми фото",
)
async def add_photos(
    listing_id: uuid.UUID,
    files: PhotosField,
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    cache: CacheDep,
) -> ListingDetail:
    await service.add_photos(session, storage, listing_id, user, files)
    await cache.delete(listing_key(listing_id))
    return await _detail_or_404(session, listing_id)


@router.delete(
    "/{listing_id}/photos/{photo_index}",
    response_model=ListingDetail,
    summary="Удалить фото",
    description="Только владелец. Индекс с 0. Единственное фото удалить нельзя.",
    response_description="Объявление без удалённого фото",
)
async def remove_photo(
    listing_id: uuid.UUID,
    photo_index: Annotated[int, Path(ge=0)],
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    cache: CacheDep,
) -> ListingDetail:
    await service.remove_photo(session, storage, listing_id, user, photo_index)
    await cache.delete(listing_key(listing_id))
    return await _detail_or_404(session, listing_id)
