import "server-only";

import { cookies } from "next/headers";

import type { AuthUser } from "@/lib/api/types";

import { ACCESS_COOKIE } from "./constants";
import { backendFetch } from "./server";

/**
 * Личные страницы рендерятся на сервере с токеном из httpOnly cookie — без ожидания
 * восстановления сессии в браузере (быстрее LCP, нет сдвигов вёрстки).
 * Access истёк или backend недоступен → null: страница догрузит данные в браузере сама
 * (store обновит токен по refresh-cookie, она видна только /api/*).
 */
export async function serverAuthFetch<T>(path: string): Promise<T | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const response = await backendFetch(path, { headers: { Authorization: `Bearer ${token}` } });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export function serverUser(): Promise<AuthUser | null> {
  return serverAuthFetch<AuthUser>("/auth/me");
}
