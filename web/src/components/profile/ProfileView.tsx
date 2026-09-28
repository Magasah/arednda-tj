"use client";

import { ServerCrash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import type { MeResponse } from "@/lib/api/types";
import { getMyProfile } from "@/lib/api/users";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";

import { BookingsTab } from "./BookingsTab";
import { MyListingsTab } from "./MyListingsTab";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileTabs } from "./ProfileTabs";
import { SettingsPanel } from "./SettingsPanel";
import { StatsRow } from "./StatsRow";

export function ProfileSkeleton() {
  return (
    <div>
      <span className="sr-only" role="status">
        {t("common.loading")}
      </span>
      <div className="bg-primary">
        <Container className="flex flex-col items-center gap-4 py-8 sm:flex-row lg:py-10">
          <span className="size-[72px] animate-pulse rounded-full bg-surface/20 motion-reduce:animate-none" />
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <span className="h-6 w-40 animate-pulse rounded bg-surface/20 motion-reduce:animate-none" />
            <span className="h-4 w-28 animate-pulse rounded bg-surface/20 motion-reduce:animate-none" />
          </div>
        </Container>
      </div>
      <Container className="py-6">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="mt-6 h-12 w-full" />
      </Container>
    </div>
  );
}

export const PROFILE_TABS = ["listings", "bookings", "incoming", "settings"] as const;

/** Вкладка в адресе (?tab=bookings) — ссылки «Все брони» и возврат «Назад» ведут на нужную */
function syncTab(id: string) {
  const url = new URL(window.location.href);
  if (id === PROFILE_TABS[0]) url.searchParams.delete("tab");
  else url.searchParams.set("tab", id);
  window.history.replaceState(window.history.state, "", url);
}

export function ProfileView({ initialTab }: { initialTab?: string }) {
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createdAt = useAuthStore((state) => state.user?.created_at ?? null);

  const load = useCallback(() => {
    setError(null);
    getMyProfile()
      .then(setProfile)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);

  if (error) {
    return (
      <Container className="py-16">
        <EmptyState
          tone="error"
          icon={<ServerCrash className="size-7" />}
          title={t("profile.errorTitle")}
          text={error}
          action={
            <Button variant="primary" size="md" onClick={load}>
              {t("common.retry")}
            </Button>
          }
        />
      </Container>
    );
  }

  if (!profile) return <ProfileSkeleton />;

  return (
    <div>
      <ProfileHeader
        name={profile.user.name}
        avatarUrl={profile.user.avatar_url}
        trustScore={profile.trust_score}
        reviewsCount={profile.reviews_summary.total}
        isVerified={profile.user.is_verified}
        memberSince={createdAt}
      />
      <Container className="-mt-4 pb-12">
        <StatsRow stats={profile.stats} />
        <div className="mt-6">
          <ProfileTabs
            label={t("profile.tabs")}
            initialId={initialTab}
            onChange={syncTab}
            tabs={[
              { id: "listings", label: t("account.tabs.listings"), content: <MyListingsTab /> },
              { id: "bookings", label: t("account.tabs.bookings"), content: <BookingsTab role="renter" /> },
              { id: "incoming", label: t("account.tabs.incoming"), content: <BookingsTab role="owner" /> },
              {
                id: "settings",
                label: t("account.tabs.settings"),
                content: <SettingsPanel profile={profile} onUpdated={setProfile} />,
              },
            ]}
          />
        </div>
      </Container>
    </div>
  );
}
