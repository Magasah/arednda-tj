// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isSameOriginRequest } from "./csrf";
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

describe("CSRF: isSameOriginRequest", () => {
  const ok = { host: "localhost:3000", origin: "http://localhost:3000", "x-requested-with": "kiroya" };

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
    const headers = { host: ok.host, "x-requested-with": "kiroya" };
    expect(isSameOriginRequest(req(headers, "POST"))).toBe(false);
    expect(isSameOriginRequest(req(headers, "GET"))).toBe(true);
  });
});
