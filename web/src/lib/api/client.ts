import { CSRF_COOKIE, CSRF_TOKEN_HEADER } from "@/lib/auth/constants";
import { API_PREFIX, PUBLIC_API_URL } from "@/lib/env";

import { errorFromResponse, networkError } from "./errors";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: Method;
  query?: Record<string, QueryValue>;
  /** Объект → JSON, FormData → multipart как есть */
  body?: unknown;
  /** Добавить Authorization: Bearer и при 401 попробовать обновить токен */
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

/** Как клиент получает и обновляет access-токен. Реализует store авторизации */
export interface AuthHooks {
  /** Дождаться восстановления сессии (иначе первый запрос уйдёт без токена и получит 401) */
  ready?(): Promise<void>;
  getToken(): string | null;
  /** Новый access-токен или null, если сессию не восстановить */
  refresh(): Promise<string | null>;
  /** Refresh не помог — выйти из аккаунта */
  onAuthFailure(): void;
}

export interface ApiClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  credentials?: RequestCredentials;
  defaultHeaders?: Record<string, string>;
  /** Заголовки, которые считаются на каждый запрос (например, CSRF-токен из cookie) */
  prepareHeaders?: (method: Method) => Promise<Record<string, string>>;
  authHooks?: () => AuthHooks | null;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}

export function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const url = `${baseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  // Один refresh на все запросы, которые одновременно получили 401
  let refreshing: Promise<string | null> | null = null;

  const refreshOnce = (hooks: AuthHooks) => {
    refreshing ??= hooks.refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  async function send(path: string, options: RequestOptions, token: string | null) {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...config.defaultHeaders,
      ...(config.prepareHeaders ? await config.prepareHeaders(method) : {}),
      ...options.headers,
    };
    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const init: RequestInit & { next?: RequestOptions["next"] } = {
      method,
      headers,
      body,
      signal: options.signal,
      credentials: config.credentials,
    };
    if (options.cache) init.cache = options.cache;
    if (options.next) init.next = options.next;

    try {
      return await fetchImpl(buildUrl(config.baseUrl, path, options.query), init);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw networkError();
    }
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const hooks = options.auth ? (config.authHooks?.() ?? null) : null;
    if (hooks?.ready) await hooks.ready();
    let response = await send(path, options, hooks?.getToken() ?? null);

    if (response.status === 401 && hooks) {
      const fresh = await refreshOnce(hooks);
      if (fresh) response = await send(path, options, fresh);
      if (!fresh || response.status === 401) {
        hooks.onAuthFailure();
        throw await errorFromResponse(response);
      }
    }

    if (!response.ok) throw await errorFromResponse(response);
    if (response.status === 204) return undefined as T;
    const type = response.headers.get("content-type") ?? "";
    return (type.includes("application/json") ? await response.json() : undefined) as T;
  }

  return { request };
}

// --- Клиенты -----------------------------------------------------------------------------

let authHooks: AuthHooks | null = null;

/** Store авторизации регистрирует здесь, как брать и обновлять токен */
export function configureAuth(hooks: AuthHooks | null): void {
  authHooks = hooks;
}

/** Браузер → backend напрямую: публичные GET и чтение своих данных с Bearer */
export const apiClient = createApiClient({
  baseUrl: `${PUBLIC_API_URL}${API_PREFIX}`,
  authHooks: () => authHooks,
});

/**
 * Браузер → Next API routes (тот же origin). Все изменяющие запросы и работа с cookie идут здесь.
 * X-Requested-With — часть CSRF-защиты: чужой сайт не может выставить этот заголовок без CORS.
 */
export const CSRF_HEADER = "x-requested-with";
export const CSRF_VALUE = "kiroya";

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const found = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
}

let csrfLoading: Promise<unknown> | null = null;

/**
 * Double-submit CSRF: токен из cookie kiroya_csrf → заголовок X-CSRF-Token.
 * Cookie ставит /api/auth/session при загрузке сайта; если её нет — один раз запрашиваем
 */
export async function csrfHeaders(method: Method): Promise<Record<string, string>> {
  if (method === "GET") return {};
  let token = readCookie(CSRF_COOKIE);
  if (!token) {
    csrfLoading ??= fetch("/api/auth/csrf", {
      credentials: "same-origin",
      headers: { [CSRF_HEADER]: CSRF_VALUE },
    })
      .catch(() => null)
      .finally(() => {
        csrfLoading = null;
      });
    await csrfLoading;
    token = readCookie(CSRF_COOKIE);
  }
  return token ? { [CSRF_TOKEN_HEADER]: token } : {};
}

export const bffClient = createApiClient({
  baseUrl: "",
  credentials: "same-origin",
  defaultHeaders: { [CSRF_HEADER]: CSRF_VALUE },
  prepareHeaders: csrfHeaders,
});
