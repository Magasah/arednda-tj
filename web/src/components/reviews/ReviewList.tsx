import { Star } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import type { ReviewItem } from "@/lib/api/types";
import { formatRelative } from "@/lib/dates";
import { messagesOf, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ReviewListProps {
  items: ReviewItem[];
  /** Компактно: без названия вещи (на странице объявления) */
  compact?: boolean;
}

export function ReviewStars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={t("reviews.star", { count: rating })}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(size, star <= rating ? "fill-accent-btn text-accent-btn" : "fill-transparent text-muted")}
        />
      ))}
    </span>
  );
}

export function ReviewList({ items, compact = false }: ReviewListProps) {
  const about = messagesOf().reviews.about;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((review) => (
        <li key={review.id} className={cn("rounded-card bg-surface shadow-card", compact ? "p-4" : "p-5")}>
          <div className="flex items-start gap-3">
            <Link href={`/user/${review.author.id}`} className="shrink-0 rounded-full" tabIndex={-1} aria-hidden>
              <Avatar src={review.author.avatar_url} name={review.author.name} size={compact ? 36 : 44} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <Link href={`/user/${review.author.id}`} className="font-semibold text-ink hover:text-primary">
                  {review.author.name || t("listing.anonymousOwner")}
                </Link>
                <time dateTime={review.created_at} className="text-[13px] text-muted">
                  {formatRelative(review.created_at)}
                </time>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ReviewStars rating={review.rating} />
                {!compact && (
                  <span className="text-[13px] text-muted">
                    {about[review.about_role]} · {t("reviews.ofListing", { title: review.listing_title })}
                  </span>
                )}
              </div>
              {review.text && (
                <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink">{review.text}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
