// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createApiClient, type AuthHooks } from "./client";
import { ApiError } from "./errors";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(responses: Response[], hooks?: Partial<AuthHooks>) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const response of responses) fetchImpl.mockResolvedValueOnce(response);
  let token: string | null = "old-token";
  const authHooks: AuthHooks = {
    getToken: () => token,
    refresh: vi.fn(async () => {
      token = "new-token";
      return token;
    }),
    onAuthFailure: vi.fn(),
    ...hooks,
  };
  const client = createApiClient({ baseUrl: "http://api.test/api/v1", fetchImpl, authHooks: () => authHooks });
  return { client, fetchImpl, authHooks };
}

const authHeader = (call: unknown[]) => new Headers((call[1] as RequestInit).headers).get("Authorization");

describe("API client: авторизация", () => {
  it("добавляет Authorization: Bearer из store", async () => {
    const { client, fetchImpl } = setup([json(200, { ok: true })]);
    await client.request("/users/me", { auth: true });
    expect(authHeader(fetchImpl.mock.calls[0])).toBe("Bearer old-token");
  });

  it("при 401 обновляет токен и повторяет запрос с новым", async () => {
    const { client, fetchImpl, authHooks } = setup([
      json(401, { detail: "Токен истёк" }),
      json(200, { name: "Фаридун" }),
    ]);

    const result = await client.request<{ name: string }>("/users/me", { auth: true });

    expect(result).toEqual({ name: "Фаридун" });
    expect(authHooks.refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(authHeader(fetchImpl.mock.calls[1])).toBe("Bearer new-token");
    expect(authHooks.onAuthFailure).not.toHaveBeenCalled();
  });

  it("если refresh не удался — выходит из аккаунта и бросает ApiError(unauthorized)", async () => {
    const { client, authHooks } = setup([json(401, { detail: "Токен истёк" })], {
      refresh: vi.fn(async () => null),
    });

    await expect(client.request("/users/me", { auth: true })).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
    expect(authHooks.onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("параллельные 401 делят один refresh", async () => {
    const { client, authHooks } = setup([
      json(401, {}),
      json(401, {}),
      json(200, { a: 1 }),
      json(200, { b: 2 }),
    ]);

    await Promise.all([
      client.request("/a", { auth: true }),
      client.request("/b", { auth: true }),
    ]);

    expect(authHooks.refresh).toHaveBeenCalledTimes(1);
  });

  it("публичные запросы без auth не трогают refresh при 401", async () => {
    const { client, authHooks, fetchImpl } = setup([json(401, { detail: "Нет" })]);
    await expect(client.request("/listings")).rejects.toBeInstanceOf(ApiError);
    expect(authHooks.refresh).not.toHaveBeenCalled();
    expect(authHeader(fetchImpl.mock.calls[0])).toBeNull();
  });
});

describe("API client: нормализация ошибок", () => {
  it("422 FastAPI → { message, code: validation, fields }", async () => {
    const { client } = setup([
      json(422, { detail: [{ loc: ["body", "phone"], msg: "Номер телефона в формате +992XXXXXXXXX" }] }),
    ]);
    const error = (await client.request("/auth/send-otp", { method: "POST", body: {} }).catch((e) => e)) as ApiError;
    expect(error.code).toBe("validation");
    expect(error.fields).toEqual({ phone: "Номер телефона в формате +992XXXXXXXXX" });
    expect(error.message).toBe("Номер телефона в формате +992XXXXXXXXX");
  });

  it("429 → понятное «Слишком много запросов»", async () => {
    const { client } = setup([json(429, { error: "Rate limit exceeded: 1 per 1 minute" })]);
    await expect(client.request("/auth/send-otp", { method: "POST", body: {} })).rejects.toMatchObject({
      code: "rate_limited",
      message: "Слишком много запросов, подождите",
    });
  });

  it("сеть упала → code: network", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    const client = createApiClient({ baseUrl: "http://api.test", fetchImpl });
    await expect(client.request("/listings")).rejects.toMatchObject({ code: "network" });
  });

  it("query: пустые значения не попадают в URL", async () => {
    const { client, fetchImpl } = setup([json(200, { items: [] })]);
    await client.request("/listings", { query: { q: "дрель", city: "", page: 2, max_price: undefined } });
    expect(fetchImpl.mock.calls[0][0]).toBe("http://api.test/api/v1/listings?q=%D0%B4%D1%80%D0%B5%D0%BB%D1%8C&page=2");
  });
});

describe("bffClient: CSRF double-submit", () => {
  it("изменяющий запрос несёт X-CSRF-Token из cookie, GET — нет", async () => {
    const { csrfHeaders } = await import("./client");
    const cookie = "a".repeat(64);
    vi.stubGlobal("document", { cookie: `other=1; kiroya_csrf=${cookie}` });
    expect(await csrfHeaders("POST")).toEqual({ "x-csrf-token": cookie });
    expect(await csrfHeaders("GET")).toEqual({});
    vi.unstubAllGlobals();
  });

  it("cookie нет — сначала запрашивает /api/auth/csrf", async () => {
    const { csrfHeaders } = await import("./client");
    const doc = { cookie: "" };
    vi.stubGlobal("document", doc);
    const fetchMock = vi.fn(async () => {
      doc.cookie = `kiroya_csrf=${"b".repeat(64)}`;
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await csrfHeaders("DELETE")).toEqual({ "x-csrf-token": "b".repeat(64) });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/csrf", expect.objectContaining({ credentials: "same-origin" }));
    vi.unstubAllGlobals();
  });
});
