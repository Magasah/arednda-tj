import { Check, ChevronRight, Star } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import type { UserShort } from "@/lib/api/types";
import { formatRating } from "@/lib/format";
import { t } from "@/lib/i18n";

export function OwnerCard({ owner }: { owner: UserShort }) {
  const name = owner.name || t("listing.anonymousOwner");

  return (
    <Link
      href={`/user/${owner.id}`}
      aria-label={t("listing.ownerProfile", { name })}
      className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card transition-colors hover:ring-1 hover:ring-primary"
    >
      <Avatar src={owner.avatar_url} name={name} size={56} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-base font-semibold text-ink">
          {name}
          {owner.is_verified && (
            <span
              title={t("common.verifiedShort")}
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-surface"
            >
              <Check className="size-3" strokeWidth={3} aria-hidden />
              <span className="sr-only">{t("common.verifiedShort")}</span>
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1 font-medium text-ink">
            <Star className="size-3.5 fill-accent text-accent" aria-hidden />
            <span aria-hidden>{formatRating(owner.trust_score)}</span>
            <span className="sr-only">{t("listing.trust", { value: formatRating(owner.trust_score) })}</span>
          </span>
          <span>{t("listing.deals", { count: owner.total_deals })}</span>
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
