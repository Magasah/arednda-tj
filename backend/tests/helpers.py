"""Общие константы и помощники тестов."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models import User

PHOTO_URL = "http://localhost:9000/test/photo.jpg"
FAKE_JPEG = b"\xff\xd8\xff" + b"\x00" * 100


async def make_user(session: AsyncSession, phone: str, name: str = "Тест") -> User:
    user = User(phone=phone, name=name, verified=True)
    session.add(user)
    await session.flush()
    return user


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}
