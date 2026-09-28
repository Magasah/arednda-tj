// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isSameOriginRequest } from "./csrf";
import { matchProxyRoute } from "./proxyRoutes";
import { clientIp } from "./server";

vi.mock("server-only", () => ({}));

function req(headers: Record<string, string>, method = "POST") {
  return new NextRequest("http://localhost:3000/api/auth/send-otp", { method, headers });
}

describe("clientIp: IP посетителя для rate limit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("без доверенного прокси заголовкам не верит (подмена X-Forwarded-For не проходит)", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7" }))).toBeNull();
  });

  it("за nginx берёт X-Real-IP", () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "X-Real-IP");
    expect(clientIp(req({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("X-Forwarded-For — последний адрес (его дописал доверенный прокси)", () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "x-forwarded-for");
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("мусор вместо IP → null", () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "x-real-ip");
    expect(clientIp(req({ "x-real-ip": "<script>" }))).toBeNull();
  });
});

const TOKEN = "a".repeat(64);

describe("CSRF: isSameOriginRequest", () => {
  const ok = {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "x-requested-with": "kiroya",
    cookie: `kiroya_csrf=${TOKEN}`,
    "x-csrf-token": TOKEN,
  };

  it("свой Origin + X-Requested-With → пропускает", () => {
    expect(isSameOriginRequest(req(ok))).toBe(true);
  });

  it("без X-Requested-With → отклоняет", () => {
    expect(isSameOriginRequest(req({ host: ok.host, origin: ok.origin }))).toBe(false);
  });

  it("чужой Origin → отклоняет", () => {
    expect(isSameOriginRequest(req({ ...ok, origin: "https://evil.com" }))).toBe(false);
  });

  it("Sec-Fetch-Site: cross-site → отклоняет", () => {
    expect(isSameOriginRequest(req({ ...ok, "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("POST без Origin → отклоняет, GET без Origin (тот же сайт) → пропускает", () => {
    const headers = { host: ok.host, "x-requested-with": "kiroya", cookie: ok.cookie, "x-csrf-token": TOKEN };
    expect(isSameOriginRequest(req(headers, "POST"))).toBe(false);
    expect(isSameOriginRequest(req(headers, "GET"))).toBe(true);
  });

  it("double-submit: без токена, с чужим токеном или без cookie → отклоняет", () => {
    const without = (name: keyof typeof ok) =>
      Object.fromEntries(Object.entries(ok).filter(([key]) => key !== name));
    expect(isSameOriginRequest(req(without("x-csrf-token")))).toBe(false);
    expect(isSameOriginRequest(req({ ...ok, "x-csrf-token": "b".repeat(64) }))).toBe(false);
    expect(isSameOriginRequest(req(without("cookie")))).toBe(false);
  });

  it("GET не требует токена (не изменяет данные)", () => {
    const plain = { host: ok.host, origin: ok.origin, "x-requested-with": "kiroya" };
    expect(isSameOriginRequest(req(plain, "GET"))).toBe(true);
  });
});

describe("BFF-прокси: белый список", () => {
  const id = "01a0dd57-d538-753e-8323-311ca4ed9c8c";

  it("пропускает действия сделки и объявления", () => {
    expect(matchProxyRoute("POST", "listings")?.body).toBe("multipart");
    expect(matchProxyRoute("PATCH", `listings/${id}`)).not.toBeNull();
    expect(matchProxyRoute("POST", `bookings/${id}/handover`)?.body).toBe("multipart");
    expect(matchProxyRoute("POST", `bookings/${id}/confirm-return`)?.body).toBe("json");
    expect(matchProxyRoute("POST", "reviews")).not.toBeNull();
  });

  it("служебные и чужие пути — нет", () => {
    expect(matchProxyRoute("POST", "users/me/telegram")).toBeNull();
    expect(matchProxyRoute("DELETE", "reviews/x")).toBeNull();
    expect(matchProxyRoute("POST", `bookings/${id}/../../admin`)).toBeNull();
    expect(matchProxyRoute("GET", "listings")).toBeNull();
    expect(matchProxyRoute("PATCH", "listings/not-a-uuid")).toBeNull();
  });
});
