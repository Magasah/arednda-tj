"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonClasses } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

const NEW_LISTING = "/listing/new";

/** Гость — сначала вход с возвратом в мастер, вошедший — сразу в мастер */
function usePostHref() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? NEW_LISTING : `/login?next=${encodeURIComponent(NEW_LISTING)}`;
}

/** «+ Разместить» в шапке (планшет и десктоп) */
export function PostListingButton({ className }: { className?: string }) {
  const href = usePostHref();
  return (
    <Link href={href} prefetch={false} className={buttonClasses("accent", "sm", cn("gap-1.5", className))}>
      <Plus className="size-4" strokeWidth={2.5} aria-hidden />
      {t("wizard.cta")}
    </Link>
  );
}

// Где FAB мешает: сам мастер, вход и карточка объявления (там снизу липкая панель «Забронировать»)
const HIDDEN_ON = [/^\/listing\/new$/, /^\/listing\/[^/]+(\/edit)?$/, /^\/login/, /^\/booking\//];

/** Плавающая оранжевая кнопка «+» справа снизу на мобиле */
export function PostListingFab() {
  const pathname = usePathname() ?? "/";
  const href = usePostHref();
  if (HIDDEN_ON.some((pattern) => pattern.test(pathname))) return null;

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={t("wizard.ctaLong")}
      className={cn(
        "fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 md:hidden",
        "flex size-14 items-center justify-center rounded-full bg-accent-btn text-surface shadow-[0_6px_20px_rgba(174,98,23,0.45)]",
        "transition-transform hover:bg-accent-btn-hover active:scale-95",
      )}
    >
      <Plus className="size-7" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}
