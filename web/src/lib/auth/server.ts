import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { API_PREFIX, serverApiUrl } from "@/lib/env";

import {
  ACCESS_COOKIE,
  ACCESS_FALLBACK_MAX_AGE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_MAX_AGE,
  SESSION_FLAG_COOKIE,
} from "./constants";

// Secure-флаг включён всегда, кроме явного COOKIE_SECURE=false (локальный http в docker)
const secure = process.env.COOKIE_SECURE !== "false";

const baseCookie = { httpOnly: true, secure, sameSite: "strict" as const };

/** Сервер сайта → backend. Секрет и IP посетителя — для rate limit по посетителю, а не по серверу */
export function backendFetch(path: string, init: RequestInit = {}, request?: NextRequest) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const secret = process.env.WEB_API_SECRET;
  const ip = request ? clientIp(request) : null;
  if (secret && ip) {
    headers.set("X-Web-Secret", secret);
    headers.set("X-Client-IP", ip);
  }
  return fetch(`${serverApiUrl()}${API_PREFIX}${path}`, { ...init, headers, cache: "no-store" });
}

/**
 * IP посетителя для rate limit на backend — только из заголовка доверенного reverse proxy.
 *
 * TRUSTED_IP_HEADER задаётся, когда перед сайтом стоит прокси, который ПЕРЕЗАПИСЫВАЕТ заголовок
 * (nginx: proxy_set_header X-Real-IP $remote_addr → TRUSTED_IP_HEADER=x-real-ip).
 * Без прокси заголовкам верить нельзя: Next.js пропускает X-Forwarded-For клиента как есть,
 * и подменой IP можно обойти лимит SMS. Тогда IP не передаём — backend считает лимит по серверу сайта.
 */
export function clientIp(request: NextRequest): string | null {
  const header = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (!header) return null;
  const raw = request.headers.get(header);
  if (!raw) return null;
  // X-Forwarded-For: последний адрес дописал ближайший (доверенный) прокси
  const value = header === "x-forwarded-for" ? raw.split(",").pop() : raw;
  const ip = value?.trim().replace(/^::ffff:/, "") ?? "";
  return /^[\d.]+$|^[\da-f:]+$/i.test(ip) ? ip : null;
}

/** Срок жизни JWT из поля exp (подпись проверяет backend, здесь только время) */
function tokenMaxAge(token: string, fallback: number): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp === "number") {
      return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
    }
  } catch {
    // невалидный токен — backend его всё равно отклонит
  }
  return fallback;
}

export function setAccessCookie(response: NextResponse, token: string) {
  response.cookies.set(ACCESS_COOKIE, token, {
    ...baseCookie,
    path: "/",
    maxAge: tokenMaxAge(token, ACCESS_FALLBACK_MAX_AGE),
  });
}

export function setSessionCookies(response: NextResponse, access: string, refresh: string) {
  setAccessCookie(response, access);
  const maxAge = tokenMaxAge(refresh, REFRESH_MAX_AGE);
  response.cookies.set(REFRESH_COOKIE, refresh, { ...baseCookie, path: REFRESH_COOKIE_PATH, maxAge });
  response.cookies.set(SESSION_FLAG_COOKIE, "1", { ...baseCookie, path: "/", maxAge });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...baseCookie, path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...baseCookie, path: REFRESH_COOKIE_PATH, maxAge: 0 });
  response.cookies.set(SESSION_FLAG_COOKIE, "", { ...baseCookie, path: "/", maxAge: 0 });
}

/** 32 случайных байта → hex (Web Crypto: работает и в Node, и в edge) */
export function newCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Выдать CSRF-токен, если его ещё нет. Не httpOnly — его читает bffClient */
export function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  if (/^[a-f0-9]{64}$/.test(request.cookies.get(CSRF_COOKIE)?.value ?? "")) return;
  response.cookies.set(CSRF_COOKIE, newCsrfToken(), {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });
}

/** Новый access по refresh-cookie. null — refresh нет или он отозван/просрочен */
export async function refreshAccess(request: NextRequest): Promise<string | null> {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const response = await backendFetch("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ detail: message }, { status });
}

/** Ответ backend → ответ клиенту с тем же статусом и телом */
export async function relay(response: Response) {
  const body = await response.text();
  return new NextResponse(body || null, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}
