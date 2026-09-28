"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/lib/store/auth";

/** Восстанавливает сессию из httpOnly cookie один раз при загрузке сайта */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return <>{children}</>;
}
