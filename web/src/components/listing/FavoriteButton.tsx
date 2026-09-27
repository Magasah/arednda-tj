"use client";

import { Heart } from "lucide-react";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Сердечко на фото (DESIGN_SYSTEM). В backend пока нет избранного — сообщаем, как в боте */
export function FavoriteButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label={t("listing.addToFavorites")}
      onClick={() => toast(t("listing.favoritesSoon"))}
      className={cn(
        "flex size-11 items-center justify-center rounded-full text-muted",
        "transition-colors hover:text-accent",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-surface/90 shadow-card">
        <Heart className="size-[18px]" aria-hidden />
      </span>
    </button>
  );
}
