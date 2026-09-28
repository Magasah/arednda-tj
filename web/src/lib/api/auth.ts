import { apiClient, bffClient } from "./client";
import type { AuthUser, SendOTPResponse, SessionResponse, SessionState } from "./types";

// Вход и сессия идут через BFF (/api/auth/*): он ставит httpOnly cookie с токенами.
// В браузерный JS попадает только короткоживущий access-токен (в память store)

export function sendOTP(phone: string): Promise<SendOTPResponse> {
  return bffClient.request("/api/auth/send-otp", { method: "POST", body: { phone } });
}

export function verifyOTP(phone: string, code: string): Promise<SessionResponse> {
  return bffClient.request("/api/auth/verify-otp", { method: "POST", body: { phone, code } });
}

/** Новый access-токен по refresh-cookie. 401 — сессии нет */
export function refreshToken(): Promise<{ accessToken: string }> {
  return bffClient.request("/api/auth/refresh", { method: "POST" });
}

/** Восстановить сессию после перезагрузки страницы (cookie → токен + пользователь) */
export function getSession(): Promise<SessionState> {
  return bffClient.request("/api/auth/session", { cache: "no-store" });
}

/** Текущий пользователь — напрямую из backend с Bearer */
export function me(): Promise<AuthUser> {
  return apiClient.request("/auth/me", { auth: true, cache: "no-store" });
}

export function logout(): Promise<{ message: string }> {
  return bffClient.request("/api/auth/logout", { method: "POST" });
}
