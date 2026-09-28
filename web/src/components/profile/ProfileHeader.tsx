import { Check, Star } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Container } from "@/components/ui/Container";
import { formatMonthYear, formatRating } from "@/lib/format";
import { plural, t, messagesOf } from "@/lib/i18n";

interface ProfileHeaderProps {
  name: string | null;
  avatarUrl: string | null;
  trustScore: string | number;
  reviewsCount: number;
  isVerified: boolean;
  /** Дата регистрации (для своего профиля), в публичном профиле её нет */
  memberSince?: string | null;
  /** h1 — на странице профиля; в других местах можно понизить */
  as?: "h1" | "h2";
}

/** Синий хедер профиля (DESIGN_SYSTEM → «Хедер профиля») */
export function ProfileHeader({
  name,
  avatarUrl,
  trustScore,
  reviewsCount,
  isVerified,
  memberSince,
  as: Heading = "h1",
}: ProfileHeaderProps) {
  const displayName = name || t("profile.noName");
  const words = messagesOf().profile.reviewWords;

  return (
    <div className="bg-primary">
      <Container className="flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:text-left lg:py-10">
        <span className="relative shrink-0">
          <Avatar src={avatarUrl} name={displayName} size={72} className="ring-[3px] ring-surface" />
          <span aria-hidden className="absolute bottom-0.5 right-0.5 size-4 rounded-full bg-success ring-2 ring-surface" />
        </span>
        <div className="min-w-0">
          <Heading className="break-words text-xl font-bold text-surface">{displayName}</Heading>
          {memberSince && (
            <p className="mt-1 text-[13px] text-primary-soft">
              {t("profile.memberSince", { date: formatMonthYear(memberSince) })}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
            <Star className="size-5 fill-accent text-accent" aria-hidden />
            <span className="text-lg font-bold text-surface">{formatRating(trustScore)}</span>
            <span className="text-[13px] text-primary-soft">
              ({t("profile.reviews", { count: reviewsCount, word: plural(reviewsCount, words) })})
            </span>
          </p>
          {isVerified && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] bg-success px-3 py-1 text-[13px] font-semibold text-surface">
              <Check className="size-4" strokeWidth={3} aria-hidden />
              {t("profile.passportVerified")}
            </p>
          )}
        </div>
      </Container>
    </div>
  );
}
