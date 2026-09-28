import type { NextRequest } from "next/server";

import { CSRF_HEADER, CSRF_VALUE } from "@/lib/api/client";

import { CSRF_COOKIE, CSRF_TOKEN_HEADER } from "./constants";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TOKEN_RE = /^[a-f0-9]{64}$/;

/** Сравнение без утечки по времени: длина токена фиксирована, сравниваем все символы */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Double-submit: токен из cookie kiroya_csrf совпадает с заголовком X-CSRF-Token */
export function hasValidCsrfToken(request: NextRequest): boolean {
  const cookie = request.cookies.get(CSRF_COOKIE)?.value ?? "";
  const header = request.headers.get(CSRF_TOKEN_HEADER) ?? "";
  return TOKEN_RE.test(cookie) && safeEqual(cookie, header);
}

/**
 * CSRF-защита API routes (в дополнение к SameSite=Strict у cookie):
 * 1. заголовок X-Requested-With: kiroya — чужой сайт не выставит его без разрешения CORS;
 * 2. Origin (если браузер его прислал) совпадает с нашим хостом;
 * 3. Sec-Fetch-Site, если есть, — same-origin;
 * 4. изменяющие запросы (POST/PATCH/PUT/DELETE) — ещё и double-submit токен.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  if (request.headers.get(CSRF_HEADER) !== CSRF_VALUE) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const safe = SAFE_METHODS.has(request.method);
  if (!safe && !hasValidCsrfToken(request)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return safe;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
