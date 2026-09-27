import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import ORMModel


class ReviewCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "booking_id": "01a0dd71-d046-70ea-8dc2-4a1149a97704",
                    "rating": 5,
                    "text": "Камера в идеальном состоянии, владелец пунктуальный",
                }
            ]
        }
    )

    booking_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    text: str | None = Field(default=None, max_length=500)


class ReviewResponse(ORMModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    rating: int
    text: str | None
    is_hidden: bool = Field(description="Скрыт антифродом — не виден в публичных списках")
    created_at: datetime


class ReviewAuthor(BaseModel):
    id: uuid.UUID
    name: str | None
    avatar_url: str | None


class ReviewItem(BaseModel):
    id: uuid.UUID
    rating: int = Field(examples=[5])
    text: str | None
    author: ReviewAuthor
    listing_title: str
    about_role: Literal["owner", "renter"] = Field(
        description="В какой роли был оцениваемый: владелец вещи или арендатор"
    )
    created_at: datetime


class ReviewPage(BaseModel):
    items: list[ReviewItem]
    total: int
    page: int
    pages: int
    avg_rating: float | None = Field(examples=[4.8])
    rating_distribution: dict[int, int] = Field(examples=[{1: 0, 2: 0, 3: 1, 4: 3, 5: 20}])
