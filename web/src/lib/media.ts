import { PUBLIC_API_URL, PUBLIC_MEDIA_URL } from "@/lib/env";

/**
 * Ссылка на фото из backend → адрес, который открывается и в браузере, и в оптимизаторе next/image.
 *
 * - "/uploads/…" (dev без MinIO, файлы backend) → "/uploads/…" — сайт проксирует в backend;
 * - "http://localhost:9000/…" (MinIO) → "/media/…" — сайт проксирует в MinIO;
 * - прочие https-адреса (CDN в проде) — как есть, разрешены в images.remotePatterns.
 *
 * Прокси нужен потому, что в docker у контейнера web свой localhost и прямые адреса недоступны.
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return url;
  if (url.startsWith(`${PUBLIC_MEDIA_URL}/`)) return `/media${url.slice(PUBLIC_MEDIA_URL.length)}`;
  if (url.startsWith(`${PUBLIC_API_URL}/uploads/`)) return url.slice(PUBLIC_API_URL.length);
  if (url.startsWith("https://")) return url;
  return null;
}
