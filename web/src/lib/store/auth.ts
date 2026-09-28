"use client";

import { toast } from "sonner";
import { create } from "zustand";

import * as authApi from "@/lib/api/auth";
import { configureAuth } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";
import { t } from "@/lib/i18n";

type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous";

interface AuthState {
  user: AuthUser | null;
  /** Только в памяти вкладки: не localStorage (XSS) — refresh-токен в httpOnly cookie */
  accessToken: string | null;
  isAuthenticated: boolean;
  status: AuthStatus;
  /** Почему сессии нет: вышел сам (тогда не уводим на /login) или истекла */
  endReason: "logout" | "expired" | null;
  /** Восстановить сессию из cookie при загрузке сайта */
  initialize(): Promise<void>;
  login(phone: string, code: string): Promise<{ isNewUser: boolean }>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  setUser(user: AuthUser): void;
  /** Обновить access-токен (для API-клиента при 401) */
  refresh(): Promise<string | null>;
  /** Refresh не удался: сессия истекла */
  expire(): void;
}

// Один запрос восстановления сессии на всех: initialize() и API-клиент ждут один и тот же промис
let initializing: Promise<void> | null = null;

const anonymous = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  status: "anonymous",
  endReason: null,
} as const;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  status: "idle",
  endReason: null,

  initialize() {
    if (get().status !== "idle") return initializing ?? Promise.resolve();
    set({ status: "loading" });
    initializing = (async () => {
      try {
        const session = await authApi.getSession();
        if (!session.user || !session.accessToken) {
          set(anonymous);
          return;
        }
        set({
          user: session.user,
          accessToken: session.accessToken,
          isAuthenticated: true,
          status: "authenticated",
          endReason: null,
        });
      } catch {
        set(anonymous);
      }
    })();
    return initializing;
  },

  async login(phone, code) {
    const session = await authApi.verifyOTP(phone, code);
    set({
      user: session.user,
      accessToken: session.accessToken,
      isAuthenticated: true,
      status: "authenticated",
      endReason: null,
    });
    return { isNewUser: Boolean(session.isNewUser) };
  },

  async logout() {
    try {
      await authApi.logout();
    } finally {
      set({ ...anonymous, endReason: "logout" });
    }
  },

  async refreshUser() {
    const user = await authApi.me();
    set({ user });
  },

  setUser(user) {
    set({ user });
  },

  async refresh() {
    try {
      const { accessToken } = await authApi.refreshToken();
      set({ accessToken });
      return accessToken;
    } catch {
      return null;
    }
  },

  expire() {
    const wasAuthenticated = get().isAuthenticated;
    set({ ...anonymous, endReason: "expired" });
    if (wasAuthenticated) toast.error(t("toast.sessionExpired"));
  },
}));

// API-клиент берёт токен из store и зовёт refresh/expire при 401
configureAuth({
  ready: () => useAuthStore.getState().initialize(),
  getToken: () => useAuthStore.getState().accessToken,
  refresh: () => useAuthStore.getState().refresh(),
  onAuthFailure: () => useAuthStore.getState().expire(),
});
