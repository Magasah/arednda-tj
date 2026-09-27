"use client";

import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

interface NavAuthProps {
  className?: string;
  /** В мобильном меню — кнопка на всю ширину */
  block?: boolean;
  onNavigate?: () => void;
}

/** «Войти» для гостя, аватар со ссылкой на профиль — для вошедшего */
export function NavAuth({ className, block = false, onNavigate }: NavAuthProps) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === "idle" || status === "loading") {
    return <Skeleton className={cn("h-11 rounded-[8px]", block ? "w-full" : "w-24", className)} />;
  }

  if (user) {
    return (
      <Link
        href="/profile"
        onClick={onNavigate}
        aria-label={t("nav.profile")}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-full transition-colors hover:bg-primary/5",
          block ? "w-full rounded-[12px] px-2 py-2" : "p-1",
          className,
        )}
      >
        <Avatar src={user.avatar_url} name={user.name} size={36} />
        {block && <span className="text-base font-medium text-ink">{t("nav.profile")}</span>}
      </Link>
    );
  }

  return (
    <Button
      href="/login"
      variant="outline"
      size="sm"
      prefetch={false}
      className={cn(block && "w-full", className)}
    >
      {t("nav.login")}
    </Button>
  );
}
