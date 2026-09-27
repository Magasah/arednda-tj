"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "@/lib/store/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Что показать, пока сессия восстанавливается */
  fallback?: React.ReactNode;
}

/**
 * Второй рубеж после middleware: cookie могла быть, но сессия истекла/отозвана.
 * Тогда store станет anonymous — уводим на вход с возвратом сюда же.
 */
export function ProtectedRoute({ children, fallback = null }: ProtectedRouteProps) {
  const status = useAuthStore((state) => state.status);
  const endReason = useAuthStore((state) => state.endReason);
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    // После «Выйти» кнопка сама уводит на главную — не перебиваем её переходом на /login
    if (status === "anonymous" && endReason !== "logout") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, endReason, router, pathname]);

  if (status !== "authenticated") return <>{fallback}</>;
  return <>{children}</>;
}
