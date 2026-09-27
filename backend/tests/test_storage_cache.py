import io
from pathlib import Path

import pytest
from fakeredis.aioredis import FakeRedis
from fastapi import HTTPException, UploadFile
from redis.exceptions import ConnectionError as RedisConnectionError

from app.core.cache import CacheService
from app.core.config import settings
from app.core.storage import StorageService, detect_image_type, read_image

JPEG = b"\xff\xd8\xff" + b"\x00" * 20
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 20


@pytest.mark.parametrize(
    ("head", "ext"), [(JPEG, "jpg"), (PNG, "png"), (WEBP, "webp"), (b"%PDF-1.7", None)]
)
def test_detect_image_type(head: bytes, ext: str | None) -> None:
    detected = detect_image_type(head[:16])
    assert (detected.extension if detected else None) == ext


async def test_read_image_rejects_spoofed_content_type() -> None:
    fake = UploadFile(io.BytesIO(b"%PDF-1.7" + b"\x00" * 50), filename="x.jpg")
    with pytest.raises(HTTPException) as exc:
        await read_image(fake)
    assert exc.value.status_code == 422


async def test_read_image_rejects_oversize(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "upload_max_bytes", 1024)
    big = UploadFile(io.BytesIO(JPEG + b"\x00" * 2048), filename="big.jpg")
    with pytest.raises(HTTPException) as exc:
        await read_image(big)
    assert exc.value.status_code == 413


async def test_local_fallback_and_safe_delete(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    storage = StorageService()
    storage.local_dir = tmp_path

    def minio_down(*_: object) -> None:
        raise OSError("connection refused")

    monkeypatch.setattr(storage, "_put_sync", minio_down)
    url = await storage.upload_file(UploadFile(io.BytesIO(JPEG), filename="a.jpg"), "listings/x")
    assert url.startswith("/uploads/listings/x/")
    assert url.endswith(".jpg")
    saved = tmp_path / url.removeprefix("/uploads/")
    assert saved.read_bytes() == JPEG

    outside = tmp_path.parent / "keep.txt"
    outside.write_text("не трогать")
    await storage.delete_file("/uploads/../keep.txt")
    assert outside.exists()

    await storage.delete_file(url)
    assert not saved.exists()


async def test_cache_roundtrip_and_delete_pattern() -> None:
    cache = CacheService(FakeRedis(decode_responses=True))
    await cache.set("listing:1", {"title": "Камера"}, 60)
    await cache.set("listing:2", {"title": "Дрель"}, 60)
    await cache.set("categories:all", [1, 2], 60)
    assert await cache.get("listing:1") == {"title": "Камера"}

    await cache.delete_pattern("listing:*")
    assert await cache.get("listing:1") is None
    assert await cache.get("listing:2") is None
    assert await cache.get("categories:all") == [1, 2]


async def test_cache_survives_redis_outage() -> None:
    class BrokenRedis:
        async def get(self, *_: object) -> None:
            raise RedisConnectionError("down")

        async def set(self, *_: object, **__: object) -> None:
            raise RedisConnectionError("down")

    cache = CacheService(BrokenRedis())  # type: ignore[arg-type]
    assert await cache.get("any") is None
    await cache.set("any", {"a": 1}, 60)
