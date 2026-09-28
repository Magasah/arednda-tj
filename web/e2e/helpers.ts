import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

// Помощники E2E: пользователи регистрируются через backend API (SMS-код — из лога backend в dev),
// сессия кладётся в браузер теми же httpOnly cookie, что ставит BFF при входе

export const API_URL = (process.env.E2E_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const BASE_URL = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** WEB_API_SECRET — из окружения или корневого .env (make setup его генерирует) */
function webSecret(): string | null {
  if (process.env.WEB_API_SECRET) return process.env.WEB_API_SECRET;
  try {
    const match = readFileSync(path.join(REPO_ROOT, ".env"), "utf8").match(/^WEB_API_SECRET=(.+)$/m);
    return match?.[1].trim() || null;
  } catch {
    return null;
  }
}

/** Код из лога backend: в ENVIRONMENT=development SMS не уходит, код пишется в лог */
function readOtp(phone: string): string | null {
  const command = process.env.E2E_BACKEND_LOGS || "docker compose logs --since 10m backend";
  const logs = execSync(command, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const matches = Array.from(logs.matchAll(new RegExp(`OTP для \\${phone}: (\\d{6})`, "g")));
  return matches.length ? matches[matches.length - 1][1] : null;
}

export interface TestUser {
  id: string;
  phone: string;
  name: string;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(request: APIRequestContext, name: string): Promise<TestUser> {
  const phone = `+99293${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
  const secret = webSecret();
  // Лимит SMS — 1 в минуту с IP. С секретом сайта backend считает его по X-Client-IP — даём каждому свой
  const headers: Record<string, string> = secret
    ? { "X-Web-Secret": secret, "X-Client-IP": `198.51.100.${randomInt(1, 254)}` }
    : {};

  let sent = await request.post(`${API_URL}/api/v1/auth/send-otp`, { headers, data: { phone } });
  if (sent.status() === 429) {
    await new Promise((resolve) => setTimeout(resolve, 61_000));
    sent = await request.post(`${API_URL}/api/v1/auth/send-otp`, { headers, data: { phone } });
  }
  expect(sent.status(), await sent.text()).toBe(200);

  let code: string | null = null;
  await expect.poll(() => (code = readOtp(phone)), { timeout: 15_000 }).not.toBeNull();

  const verified = await request.post(`${API_URL}/api/v1/auth/verify-otp`, { headers, data: { phone, code } });
  expect(verified.ok(), await verified.text()).toBeTruthy();
  const tokens = (await verified.json()) as { access_token: string; refresh_token: string };

  const renamed = await request.patch(`${API_URL}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    multipart: { name },
  });
  expect(renamed.ok()).toBeTruthy();
  const me = (await renamed.json()) as { user: { id: string } };

  return { id: me.user.id, phone, name, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
}

/** Войти в браузере: те же cookie, что ставит /api/auth/verify-otp */
export async function signIn(context: BrowserContext, user: TestUser) {
  const url = new URL(BASE_URL);
  const base = { domain: url.hostname, httpOnly: true, secure: false, sameSite: "Strict" as const };
  await context.addCookies([
    { ...base, name: "kiroya_at", value: user.accessToken, path: "/" },
    { ...base, name: "kiroya_rt", value: user.refreshToken, path: "/api" },
    { ...base, name: "kiroya_session", value: "1", path: "/" },
  ]);
}

export async function api<T>(request: APIRequestContext, user: TestUser, pathname: string): Promise<T> {
  const response = await request.get(`${API_URL}/api/v1${pathname}`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as T;
}

export const fixture = (name: string) => path.join(__dirname, "fixtures", name);
