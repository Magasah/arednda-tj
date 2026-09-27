import "server-only";

import { NextResponse } from "next/server";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const SEGMENT_RE = /^[\w.-]+$/;

/**
 * Проксирует картинку с внутреннего адреса (MinIO / backend в docker-сети).
 * Только GET, только безопасные сегменты пути (без ../) и только image/* — это не открытый прокси.
 */
export async function proxyImage(baseUrl: string, segments: string[]) {
  if (segments.length === 0 || !segments.every((part) => SEGMENT_RE.test(part) && part !== "..")) {
    return new NextResponse(null, { status: 404 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/+$/, "")}/${segments.join("/")}`, {
      cache: "no-store",
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!upstream.ok || !IMAGE_TYPES.has(type)) {
    return new NextResponse(null, { status: upstream.ok ? 415 : upstream.status === 404 ? 404 : 502 });
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
