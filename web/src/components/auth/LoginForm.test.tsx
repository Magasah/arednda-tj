import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "@/test/mocks";

import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore } from "@/lib/store/auth";

import { LoginForm } from "./LoginForm";
import { MAX_CODE_ATTEMPTS } from "./loginLock";

vi.mock("@/lib/api/auth", () => ({
  sendOTP: vi.fn(),
  verifyOTP: vi.fn(),
  refreshToken: vi.fn(),
  getSession: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
}));

const sendOTP = vi.mocked(authApi.sendOTP);
const verifyOTP = vi.mocked(authApi.verifyOTP);

const user = {
  id: "0199aaaa-0000-7000-8000-000000000001",
  phone: "+992900000001",
  name: "Фаридун",
  avatar_url: null,
  trust_score: "4.50",
  is_verified: false,
  created_at: "2026-03-01T10:00:00Z",
};

async function enterPhone(digits: string) {
  const u = userEvent.setup();
  render(<LoginForm nextPath="/listing/abc" />);
  const input = screen.getByLabelText("Номер телефона");
  await u.clear(input);
  await u.type(input, digits);
  return u;
}

describe("LoginForm — шаг 1: телефон", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, status: "anonymous" });
  });

  it("маска +992 __ ___ __ __ при вводе", async () => {
    await enterPhone("900123456");
    expect(screen.getByLabelText("Номер телефона")).toHaveValue("+992 90 012 34 56");
  });

  it("неполный номер → ошибка у поля, запрос не отправляется", async () => {
    const u = await enterPhone("90012");
    await u.click(screen.getByRole("button", { name: "Получить код" }));
    expect(await screen.findByText("Введите номер полностью: +992 и 9 цифр")).toBeInTheDocument();
    expect(screen.getByLabelText("Номер телефона")).toHaveAttribute("aria-invalid", "true");
    expect(sendOTP).not.toHaveBeenCalled();
  });

  it("верный номер → POST send-otp в E.164, переход к коду и блок кнопки на 60 с", async () => {
    sendOTP.mockResolvedValue({ message: "Код отправлен", expires_in: 300 });
    const u = await enterPhone("900000001");
    await u.click(screen.getByRole("button", { name: "Получить код" }));

    expect(sendOTP).toHaveBeenCalledWith("+992900000001");
    expect(await screen.findByRole("heading", { name: "Введите код из SMS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Отправить повторно через 60 с/ })).toBeDisabled();
  });

  it("429 → «Слишком много запросов, подождите»", async () => {
    sendOTP.mockRejectedValue(new ApiError("Слишком много запросов, подождите", "rate_limited", 429));
    const u = await enterPhone("900000001");
    await u.click(screen.getByRole("button", { name: "Получить код" }));
    expect(await screen.findByText("Слишком много запросов, подождите")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Получить код через/ })).toBeDisabled();
  });
});

describe("LoginForm — шаг 2: код", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, status: "anonymous" });
    sendOTP.mockResolvedValue({ message: "Код отправлен", expires_in: 300 });
  });

  async function toCodeStep() {
    const u = await enterPhone("900000001");
    await u.click(screen.getByRole("button", { name: "Получить код" }));
    await screen.findByRole("heading", { name: "Введите код из SMS" });
    return u;
  }

  it("верный код → вход и редирект на страницу, откуда пришли", async () => {
    verifyOTP.mockResolvedValue({ accessToken: "access", user, isNewUser: false });
    const u = await toCodeStep();
    await u.keyboard("123456");

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/listing/abc"));
    expect(verifyOTP).toHaveBeenCalledWith("+992900000001", "123456");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.name).toBe("Фаридун");
  });

  it("неверный код → красная подсветка, сообщение и счётчик попыток", async () => {
    verifyOTP.mockRejectedValue(new ApiError("Неверный или просроченный код", "unauthorized", 401));
    const u = await toCodeStep();
    await u.keyboard("000000");

    expect(await screen.findByText(/Неверный или просроченный код\. Осталось попыток: 4/)).toBeInTheDocument();
    expect(screen.getByLabelText("Цифра 1 из 6")).toHaveAttribute("aria-invalid", "true");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("5 неверных кодов → блокировка на 5 минут", async () => {
    verifyOTP.mockRejectedValue(new ApiError("Неверный или просроченный код", "unauthorized", 401));
    const u = await toCodeStep();
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      await act(async () => {
        await u.keyboard("000000");
      });
    }
    expect(await screen.findByText(/Попробуйте через 5 мин/)).toBeInTheDocument();
    expect(screen.getByLabelText("Цифра 1 из 6")).toBeDisabled();
    expect(verifyOTP).toHaveBeenCalledTimes(MAX_CODE_ATTEMPTS);
  });
});
