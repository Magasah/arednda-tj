import { Check, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { KiroyaIcon } from "@/components/ui/KiroyaIcon";
import type { ListingCard as ListingCardData } from "@/lib/api/types";
import { formatMoney, formatRating } from "@/lib/format";
import { t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

import { categoryIcon } from "./categoryIcon";
import { FavoriteButton } from "./FavoriteButton";

interface ListingCardProps {
  listing: ListingCardData;
  /** Первые карточки над сгибом — грузим сразу */
  priority?: boolean;
  className?: string;
}

// 2 колонки на мобиле, 3 на планшете, 4 на десктопе — под них размеры картинки
const IMAGE_SIZES = "(min-width: 1280px) 280px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

export function ListingCard({ listing, priority = false, className }: ListingCardProps) {
  const photo = mediaUrl(listing.photos[0]);
  const hasRating = listing.rating_count > 0 && listing.rating_avg != null;
  const deposit = Number.parseFloat(listing.deposit_amount);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card",
        "transition-transform hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[12px] bg-deposit-bg">
        {photo ? (
          <Image
            src={photo}
            alt={listing.title}
            fill
            sizes={IMAGE_SIZES}
            priority={priority}
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-accent">
            <KiroyaIcon name={categoryIcon(listing.category_slug)} size={40} />
            <span className="sr-only">{t("listing.noPhoto")}</span>
          </span>
        )}
        {listing.is_verified_owner && (
          <span
            title={t("common.verified")}
            className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-success text-surface ring-2 ring-surface"
          >
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
            <span className="sr-only">{t("common.verified")}</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
          {/* Растянутая ссылка: вся карточка кликабельна, а сердечко остаётся отдельной кнопкой */}
          <Link
            href={`/listing/${listing.id}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-primary"
          >
            {listing.title}
          </Link>
        </h3>
        <p className="text-lg font-bold leading-tight text-accent-text">
          {t("common.perDay", { price: formatMoney(listing.price_per_day) })}
        </p>
        <p className="w-fit rounded-[8px] bg-deposit-bg px-2 py-0.5 text-xs font-medium text-accent-text">
          {deposit > 0 ? t("common.deposit", { amount: formatMoney(deposit) }) : t("common.depositNone")}
        </p>
        <p className="mt-auto flex items-center gap-1 pt-1 text-[13px] font-medium text-ink">
          {hasRating ? (
            <>
              <Star className="size-3.5 fill-accent text-accent" aria-hidden />
              <span aria-hidden>
                {formatRating(listing.rating_avg)} ({listing.rating_count})
              </span>
              <span className="sr-only">
                {t("common.rating", { value: formatRating(listing.rating_avg), count: listing.rating_count })}
              </span>
            </>
          ) : (
            <span className="font-normal text-muted">{t("common.noRating")}</span>
          )}
        </p>
      </div>

      <FavoriteButton className="absolute right-1 top-1 z-10" />
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div aria-hidden className="flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card">
      <span className="block aspect-[4/3] w-full animate-pulse bg-border motion-reduce:animate-none" />
      <div className="flex flex-col gap-2 p-3">
        <span className="h-4 w-4/5 animate-pulse rounded bg-border motion-reduce:animate-none" />
        <span className="h-5 w-1/2 animate-pulse rounded bg-border motion-reduce:animate-none" />
        <span className="h-4 w-2/3 animate-pulse rounded bg-border motion-reduce:animate-none" />
        <span className="h-3 w-1/3 animate-pulse rounded bg-border motion-reduce:animate-none" />
      </div>
    </div>
  );
}
