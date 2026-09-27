"""Хранилище фото: MinIO (S3). На dev при недоступном MinIO — локальная папка uploads/."""

import asyncio
import io
import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

import urllib3
from fastapi import Depends, HTTPException, UploadFile, status
from minio import Minio
from minio.error import MinioException

from app.core.config import settings
from app.core.logging import logger

LOCAL_URL_PREFIX = "/uploads"
# Публичное чтение только для этих префиксов; всё в private/ (паспорта) закрыто
PUBLIC_PREFIXES = ("listings", "avatars", "handovers")
PRIVATE_PREFIX = "private"
_CHUNK = 256 * 1024


@dataclass(frozen=True)
class ImageType:
    extension: str
    content_type: str


# Определяем формат по сигнатуре файла, а не по Content-Type от клиента
def detect_image_type(head: bytes) -> ImageType | None:
    if head.startswith(b"\xff\xd8\xff"):
        return ImageType("jpg", "image/jpeg")
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return ImageType("png", "image/png")
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ImageType("webp", "image/webp")
    return None


async def read_image(file: UploadFile) -> tuple[bytes, ImageType]:
    """Читает файл с ограничением размера и проверяет формат. Ошибка → 413/422."""
    await file.seek(0)
    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(_CHUNK):
        size += len(chunk)
        if size > settings.upload_max_bytes:
            raise HTTPException(
                status.HTTP_413_CONTENT_TOO_LARGE,
                f"Файл {file.filename!r} больше {settings.upload_max_bytes // 1024 // 1024} МБ",
            )
        chunks.append(chunk)
    await file.seek(0)

    data = b"".join(chunks)
    image_type = detect_image_type(data[:16])
    if not data or image_type is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Файл {file.filename!r}: допустимы только JPEG, PNG и WebP",
        )
    return data, image_type


class StorageService:
    def __init__(self) -> None:
        self._client: Minio | None = None
        self._bucket_ready = False
        self.local_dir = Path(settings.local_upload_dir).resolve()
        # Отдельная папка, которая НЕ раздаётся через /uploads
        self.local_private_dir = Path(f"{settings.local_upload_dir}_private").resolve()

    @property
    def client(self) -> Minio:
        if self._client is None:
            # Короткие таймауты и 1 повтор: недоступный MinIO не должен вешать запрос
            http = urllib3.PoolManager(
                timeout=urllib3.Timeout(connect=2, read=15),
                retries=urllib3.Retry(total=1, backoff_factor=0.2),
            )
            self._client = Minio(
                settings.minio_endpoint,
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key.get_secret_value(),
                secure=settings.minio_use_ssl,
                http_client=http,
            )
        return self._client

    def _ensure_bucket_sync(self) -> None:
        if self._bucket_ready:
            return
        bucket = settings.minio_bucket
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)
        # Фото объявлений/аватары/фото-акты публичны; private/ — нет. Листинга бакета нет
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/{p}/*" for p in PUBLIC_PREFIXES],
                }
            ],
        }
        self.client.set_bucket_policy(bucket, json.dumps(policy))
        self._bucket_ready = True

    async def ensure_bucket(self) -> bool:
        try:
            await asyncio.to_thread(self._ensure_bucket_sync)
        except (MinioException, urllib3.exceptions.HTTPError, OSError) as exc:
            logger.warning("minio_unavailable", error=str(exc))
            return False
        return True

    def get_public_url(self, object_name: str) -> str:
        base = settings.minio_public_url.rstrip("/")
        return f"{base}/{settings.minio_bucket}/{object_name}"

    async def upload_file(self, file: UploadFile, folder: str) -> str:
        """Сохраняет фото и возвращает публичный URL. Имя: {folder}/{uuid4}.{ext}."""
        data, image_type = await read_image(file)
        object_name = f"{folder.strip('/')}/{uuid.uuid4().hex}.{image_type.extension}"

        try:
            await asyncio.to_thread(self._put_sync, object_name, data, image_type.content_type)
        except (MinioException, urllib3.exceptions.HTTPError, OSError) as exc:
            if not settings.is_dev:
                logger.error("photo_upload_failed", object=object_name, error=str(exc))
                raise HTTPException(
                    status.HTTP_503_SERVICE_UNAVAILABLE, "Хранилище фото недоступно"
                ) from exc
            logger.warning("minio_unavailable_local_fallback", object=object_name)
            return await asyncio.to_thread(self._save_local_sync, object_name, data)

        return self.get_public_url(object_name)

    async def upload_many(self, files: list[UploadFile], folder: str) -> list[str]:
        """Загружает пачку фото атомарно: сначала проверка всех, при сбое — откат загруженных."""
        for file in files:
            await read_image(file)

        urls: list[str] = []
        try:
            for file in files:
                urls.append(await self.upload_file(file, folder))
        except Exception:
            for url in urls:
                await self.delete_file(url)
            raise
        return urls

    async def upload_private(self, file: UploadFile, folder: str) -> str:
        """Документы (паспорт): не публичны, возвращается ключ объекта, а не URL."""
        data, image_type = await read_image(file)
        object_name = (
            f"{PRIVATE_PREFIX}/{folder.strip('/')}/{uuid.uuid4().hex}.{image_type.extension}"
        )
        try:
            await asyncio.to_thread(self._put_sync, object_name, data, image_type.content_type)
        except (MinioException, urllib3.exceptions.HTTPError, OSError) as exc:
            if not settings.is_dev:
                logger.error("private_upload_failed", object=object_name, error=str(exc))
                raise HTTPException(
                    status.HTTP_503_SERVICE_UNAVAILABLE, "Хранилище недоступно"
                ) from exc
            path = self.local_private_dir / object_name
            await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
            await asyncio.to_thread(path.write_bytes, data)
        return object_name

    def _put_sync(self, object_name: str, data: bytes, content_type: str) -> None:
        self._ensure_bucket_sync()
        self.client.put_object(
            settings.minio_bucket,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    def _save_local_sync(self, object_name: str, data: bytes) -> str:
        path = self.local_dir / object_name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{LOCAL_URL_PREFIX}/{object_name}"

    async def delete_file(self, url: str) -> None:
        """Удаляет файл по URL, который вернул upload_file. Ошибки только логируются."""
        path = urlparse(url).path
        try:
            if path.startswith(f"{LOCAL_URL_PREFIX}/"):
                target = (self.local_dir / path.removeprefix(f"{LOCAL_URL_PREFIX}/")).resolve()
                # Защита от path traversal: удаляем только внутри uploads/
                if target.is_relative_to(self.local_dir):
                    await asyncio.to_thread(target.unlink, missing_ok=True)
                return

            prefix = f"/{settings.minio_bucket}/"
            if path.startswith(prefix):
                await asyncio.to_thread(
                    self.client.remove_object, settings.minio_bucket, path.removeprefix(prefix)
                )
        except (MinioException, urllib3.exceptions.HTTPError, OSError) as exc:
            logger.warning("photo_delete_failed", url=url, error=str(exc))


storage = StorageService()


def get_storage() -> StorageService:
    return storage


StorageDep = Annotated[StorageService, Depends(get_storage)]
