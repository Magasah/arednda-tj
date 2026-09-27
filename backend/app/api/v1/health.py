"""Health-пробы для Docker / Kubernetes / балансировщика."""

import asyncio

from fastapi import APIRouter, Response, status

from app.core.database import check_database
from app.core.redis import check_redis

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/live")
async def liveness() -> dict[str, str]:
    """Процесс жив (без проверки зависимостей)."""
    return {"status": "ok"}


@router.get("/ready")
async def readiness(response: Response) -> dict[str, object]:
    """Готов принимать трафик: PostgreSQL и Redis доступны."""
    db_ok, redis_ok = await asyncio.gather(check_database(), check_redis())
    ready = db_ok and redis_ok
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ok" if ready else "unavailable",
        "checks": {"postgres": db_ok, "redis": redis_ok},
    }
