import { type NextRequest } from "next/server";

import { ACCESS_COOKIE } from "@/lib/auth/constants";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { backendFetch, jsonError, refreshAccess, relay, setAccessCookie } from "@/lib/auth/server";

// Изменение профиля (имя, аватар): multipart → backend PATCH /users/me с токеном из httpOnly cookie

export const dynamic = "force-dynamic";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_NAME_LENGTH = 100;

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return jsonError("Запрос отклонён", 403);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_AVATAR_BYTES + 64 * 1024) return jsonError("Файл больше 10 МБ", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Ожидается multipart/form-data", 400);
  }

  const outgoing = new FormData();
  const name = form.get("name");
  if (typeof name === "string") {
    const trimmed = name.trim();
    if (trimmed.length > MAX_NAME_LENGTH) return jsonError("Имя не длиннее 100 символов", 422);
    outgoing.set("name", trimmed);
  }
  const avatar = form.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (!AVATAR_TYPES.has(avatar.type) || avatar.size > MAX_AVATAR_BYTES) {
      return jsonError("Нужен файл JPEG, PNG или WebP до 10 МБ", 422);
    }
    outgoing.set("avatar", avatar, avatar.name);
  }

  let access = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  let refreshed = false;
  const send = (token: string) =>
    backendFetch("/users/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: outgoing,
    });

  try {
    let response = access ? await send(access) : null;
    if (!response || response.status === 401) {
      access = await refreshAccess(request);
      if (!access) return jsonError("Сессия истекла", 401);
      refreshed = true;
      response = await send(access);
    }
    const result = await relay(response);
    if (refreshed && access) setAccessCookie(result, access);
    return result;
  } catch {
    return jsonError("Сервер временно недоступен", 503);
  }
}
