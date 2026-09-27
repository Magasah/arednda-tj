"""Главный роутер API v1 — сюда подключаются роутеры сервисов."""

from fastapi import APIRouter

from app.api.v1 import health
from app.services.analytics.router import router as analytics_router
from app.services.auth.router import router as auth_router
from app.services.booking.router import router as booking_router
from app.services.escrow.router import router as escrow_router
from app.services.listings.router import router as listings_router
from app.services.notifications.router import router as notifications_router
from app.services.reviews.router import router as reviews_router
from app.services.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth_router)
api_router.include_router(listings_router)
api_router.include_router(users_router)
api_router.include_router(booking_router)
api_router.include_router(escrow_router)
api_router.include_router(reviews_router)
api_router.include_router(notifications_router)
api_router.include_router(analytics_router)
