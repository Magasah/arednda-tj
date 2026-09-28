// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { ACCESS_COOKIE, SESSION_FLAG_COOKIE } from "@/lib/auth/constants";
import { safeNextPath } from "@/lib/auth/routes";

import { middleware } from "./middleware";

function request(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
}

describe("middleware: защищённые страницы", () => {
  it("без токена редиректит /profile → /login?next=/profile", () => {
    const response = middleware(request("/profile"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/profile");
  });

  it("сохраняет вложенный путь и query в next", () => {
    const response = middleware(request("/profile/settings?tab=avatar"));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/profile/settings?tab=avatar");
  });

  it("с access-cookie пропускает", () => {
    const response = middleware(request("/profile", { [ACCESS_COOKIE]: "jwt" }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("только с меткой сессии (access истёк, refresh жив) — пропускает, токен обновит клиент", () => {
    const response = middleware(request("/profile", { [SESSION_FLAG_COOKIE]: "1" }));
    expect(response.headers.get("location")).toBeNull();
  });

  it("публичные страницы не трогает (и карточку объявления тоже)", () => {
    expect(middleware(request("/catalog")).headers.get("location")).toBeNull();
    expect(middleware(request("/listing/abc")).headers.get("location")).toBeNull();
  });

  it.each(["/listing/new", "/listing/abc/edit", "/booking/abc"])("%s без входа → /login?next=…", (path) => {
    const location = new URL(middleware(request(path)).headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(path);
  });
});

describe("safeNextPath: защита от открытого редиректа", () => {
  it.each([
    ["/listing/123", "/listing/123"],
    ["//evil.com", "/profile"],
    ["/\\evil.com", "/profile"],
    ["https://evil.com", "/profile"],
    ["/login?next=/profile", "/profile"],
    [undefined, "/profile"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
