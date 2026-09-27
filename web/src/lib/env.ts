// Адреса окружения. NEXT_PUBLIC_* встраиваются в клиентский JS при сборке — только адреса, без секретов

const trimSlash = (value: string) => value.replace(/\/+$/, "");

/** Backend для браузера (CORS разрешён для сайта) */
export const PUBLIC_API_URL = trimSlash(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

/** Публичный адрес сайта: canonical, sitemap, Open Graph */
export const SITE_URL = trimSlash(process.env.NEXT_PUBLIC_SITE_URL || "https://kiroya.tj");

/** Публичный адрес MinIO: такие ссылки на фото сайт отдаёт через свой /media */
export const PUBLIC_MEDIA_URL = trimSlash(process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:9000");

export const API_PREFIX = "/api/v1";

/**
 * Backend для сервера сайта. В docker — http://backend:8000 (у контейнера web свой localhost).
 * Только на сервере: в браузере переменной нет.
 */
export function serverApiUrl(): string {
  return trimSlash(process.env.API_INTERNAL_URL || PUBLIC_API_URL);
}
