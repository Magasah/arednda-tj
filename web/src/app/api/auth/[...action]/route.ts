import { NextResponse, type NextRequest } from "next/server";

import type { AuthUser, TokenResponse } from "@/lib/api/types";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/constants";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import {
  backendFetch,
  clearSessionCookies,
  ensureCsrfCookie,
  jsonError,
  refreshAccess,
  relay,
  setAccessCookie,
  setSessionCookies,
} from "@/lib/auth/server";

// BFF входа: браузер ↔ этот route ↔ backend. Токены живут в httpOnly cookie (SameSite=Strict),
// в JS отдаётся только access-токен для запросов к backend. Refresh-токен наружу не выходит

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { action: string[] };
}

const PHONE_RE = /^\+992\d{9}$/;
const CODE_RE = /^\d{6}$/;

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function fetchMe(access: string): Promise<AuthUser | null> {
  const response = await backendFetch("/auth/me", { headers: { Authorization: `Bearer ${access}` } });
  return response.ok ? ((await response.json()) as AuthUser) : null;
}

async function sendOtp(request: NextRequest) {
  const { phone } = await readJson(request);
  if (typeof phone !== "string" || !PHONE_RE.test(phone)) {
    return jsonError("Номер телефона в формате +992XXXXXXXXX", 422);
  }
  const response = await backendFetch(
    "/auth/send-otp",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) },
    request,
  );
  return relay(response);
}

async function verifyOtp(request: NextRequest) {
  const { phone, code } = await readJson(request);
  if (typeof phone !== "string" || !PHONE_RE.test(phone) || typeof code !== "string" || !CODE_RE.test(code)) {
    return jsonError("Неверный или просроченный код", 422);
  }
  const response = await backendFetch(
    "/auth/verify-otp",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) },
    request,
  );
  if (!response.ok) return relay(response);

  const tokens = (await response.json()) as TokenResponse;
  const user = await fetchMe(tokens.access_token);
  if (!user || !tokens.refresh_token) return jsonError("Не удалось войти", 502);

  const result = NextResponse.json({
    accessToken: tokens.access_token,
    user,
    isNewUser: Boolean(tokens.is_new_user),
  });
  setSessionCookies(result, tokens.access_token, tokens.refresh_token);
  return result;
}

async function refresh(request: NextRequest) {
  const access = await refreshAccess(request);
  if (!access) {
    const result = jsonError("Сессия истекла", 401);
    clearSessionCookies(result);
    return result;
  }
  const result = NextResponse.json({ accessToken: access });
  setAccessCookie(result, access);
  return result;
}

/** Восстановление сессии после перезагрузки: cookie → access-токен + пользователь */
async function session(request: NextRequest) {
  let access = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  let user = access ? await fetchMe(access) : null;
  let refreshed = false;

  if (!user) {
    access = await refreshAccess(request);
    user = access ? await fetchMe(access) : null;
    refreshed = true;
  }
  if (!access || !user) {
    // Гость — не ошибка: 200 без пользователя, чтобы не сыпать 401 в консоль на каждой странице
    const result = NextResponse.json({ accessToken: null, user: null });
    if (request.cookies.has(REFRESH_COOKIE) || request.cookies.has(ACCESS_COOKIE)) {
      clearSessionCookies(result);
    }
    result.headers.set("Cache-Control", "no-store");
    ensureCsrfCookie(request, result);
    return result;
  }

  const result = NextResponse.json({ accessToken: access, user });
  if (refreshed) setAccessCookie(result, access);
  result.headers.set("Cache-Control", "no-store");
  ensureCsrfCookie(request, result);
  return result;
}

/** Только выдать CSRF-токен (если cookie потерялась до первого изменяющего запроса) */
async function csrf(request: NextRequest) {
  const result = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  ensureCsrfCookie(request, result);
  return result;
}

async function logout(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value ?? (await refreshAccess(request));
  const refreshTokenValue = request.cookies.get(REFRESH_COOKIE)?.value;
  if (access) {
    // Отзываем оба токена на backend; даже если он недоступен — cookie всё равно чистим
    await backendFetch("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshTokenValue ?? null }),
    }).catch(() => null);
  }
  const result = NextResponse.json({ message: "Выход выполнен" });
  clearSessionCookies(result);
  return result;
}

const postHandlers: Record<string, (request: NextRequest) => Promise<NextResponse>> = {
  "send-otp": sendOtp,
  "verify-otp": verifyOtp,
  refresh,
  logout,
};

async function guarded(request: NextRequest, handler: (request: NextRequest) => Promise<NextResponse>) {
  if (!isSameOriginRequest(request)) return jsonError("Запрос отклонён", 403);
  try {
    return await handler(request);
  } catch {
    return jsonError("Сервер временно недоступен", 503);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const handler = postHandlers[params.action.join("/")];
  if (!handler) return jsonError("Не найдено", 404);
  return guarded(request, handler);
}

const getHandlers: Record<string, (request: NextRequest) => Promise<NextResponse>> = { session, csrf };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const handler = getHandlers[params.action.join("/")];
  if (!handler) return jsonError("Не найдено", 404);
  return guarded(request, handler);
}
