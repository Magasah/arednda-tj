"use client";

import { PackageOpen, ServerCrash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ListingCard } from "@/components/listing/ListingCard";
import { gridClasses } from "@/components/listing/grid";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import type { MeResponse } from "@/lib/api/types";
import { getMyProfile } from "@/lib/api/users";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";

import { BookingsList } from "./BookingsList";
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

export function ProfileView() {
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
            tabs={[
              {
                id: "listings",
                label: t("profile.myListings"),
                content:
                  profile.active_listings.length > 0 ? (
                    <>
                      <h2 className="sr-only">{t("profile.myListings")}</h2>
                      <ul className={gridClasses}>
                        {profile.active_listings.map((listing) => (
                          <li key={listing.id}>
                            <ListingCard listing={listing} />
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <EmptyState
                      icon={<PackageOpen className="size-7" />}
                      title={t("profile.listingsEmptyTitle")}
                      text={t("profile.listingsEmptyText")}
                    />
                  ),
              },
              { id: "bookings", label: t("profile.myBookings"), content: <BookingsList /> },
              {
                id: "settings",
                label: t("profile.settings"),
                content: <SettingsPanel profile={profile} onUpdated={setProfile} />,
              },
            ]}
          />
        </div>
      </Container>
    </div>
  );
}
