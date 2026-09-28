import { type NextRequest } from "next/server";

import { ACCESS_COOKIE } from "@/lib/auth/constants";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { matchProxyRoute, PROXY_MAX_BYTES } from "@/lib/auth/proxyRoutes";
import { backendFetch, jsonError, refreshAccess, relay, setAccessCookie } from "@/lib/auth/server";

// BFF для изменяющих запросов: браузер → /api/proxy/<путь backend> → backend с Bearer из httpOnly cookie.
// Пропускаются только пути из белого списка (proxyRoutes.ts), каждый запрос — с CSRF-проверкой

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { path: string[] };
}

class TooLarge extends Error {}

/** Тело запроса с ограничением размера — даже если Content-Length не прислали (chunked) */
async function readBody(request: NextRequest, max: number): Promise<ArrayBuffer | null> {
  if (!request.body) return null;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max) throw new TooLarge();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new TooLarge();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

async function handle(request: NextRequest, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) return jsonError("Запрос отклонён", 403);

  const path = params.path.join("/");
  const rule = matchProxyRoute(request.method, path);
  if (!rule) return jsonError("Не найдено", 404);

  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.startsWith("multipart/form-data");
  if (rule.body === "json" && !contentType.startsWith("application/json") && request.method !== "DELETE") {
    return jsonError("Ожидается application/json", 415);
  }
  if (rule.body === "multipart" && !isMultipart) return jsonError("Ожидается multipart/form-data", 415);

  let body: ArrayBuffer | null;
  try {
    body = await readBody(request, isMultipart ? PROXY_MAX_BYTES : 64 * 1024);
  } catch (error) {
    if (error instanceof TooLarge) return jsonError("Слишком большой запрос", 413);
    return jsonError("Не удалось прочитать запрос", 400);
  }

  const send = (token: string) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body && contentType) headers["Content-Type"] = contentType;
    return backendFetch(`/${path}`, { method: request.method, headers, body }, request);
  };

  let access = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  let refreshed = false;
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

export { handle as POST, handle as PATCH, handle as DELETE };
