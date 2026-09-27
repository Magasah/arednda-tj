import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.core.cache import CacheDep
from app.core.database import SessionDep
from app.core.security import CurrentUser
from app.services.reviews import service
from app.services.reviews.schemas import ReviewCreate, ReviewPage, ReviewResponse
from app.services.reviews.trust import trust_key

router = APIRouter(prefix="/reviews", tags=["Reviews"])

Page = Annotated[int, Query(ge=1)]
Limit = Annotated[int, Query(ge=1, le=50)]


@router.post(
    "",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Оставить отзыв",
    description=(
        "Только участник завершённой сделки, один раз, не позже 14 дней после завершения. "
        "Отзыв проходит антифрод: при fraud_score ≥ 0.7 он скрывается из публичных списков. "
        "Trust score обоих участников пересчитывается."
    ),
    response_description="Созданный отзыв",
)
async def create_review(
    data: ReviewCreate, user: CurrentUser, session: SessionDep, cache: CacheDep
) -> ReviewResponse:
    review, affected = await service.create_review(session, user, data)
    for user_id in affected:
        await cache.delete(trust_key(user_id))
    return ReviewResponse.model_validate(review)


@router.get(
    "/user/{user_id}",
    response_model=ReviewPage,
    summary="Отзывы о пользователе",
    description="Видимые отзывы (без скрытых антифродом и удалённых) + средняя и распределение.",
    response_description="Страница отзывов",
)
async def user_reviews(
    user_id: uuid.UUID, session: SessionDep, page: Page = 1, limit: Limit = 20
) -> ReviewPage:
    return await service.user_reviews(session, user_id, page, limit)


@router.get(
    "/listing/{listing_id}",
    response_model=ReviewPage,
    summary="Отзывы об арендаторах вещи",
    description="Что владелец написал о тех, кто брал эту вещь.",
    response_description="Страница отзывов",
)
async def listing_reviews(
    listing_id: uuid.UUID, session: SessionDep, page: Page = 1, limit: Limit = 20
) -> ReviewPage:
    return await service.listing_renter_reviews(session, listing_id, page, limit)


@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить свой отзыв",
    description="Мягкое удаление, только автор и только в течение 24 часов после создания.",
    response_description="Отзыв удалён",
)
async def delete_review(
    review_id: uuid.UUID, user: CurrentUser, session: SessionDep, cache: CacheDep
) -> Response:
    to_user_id = await service.delete_review(session, review_id, user)
    await cache.delete(trust_key(to_user_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
