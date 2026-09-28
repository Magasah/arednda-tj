import type { Metadata } from "next";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProfileSkeleton, ProfileView } from "@/components/profile/ProfileView";
import type { BookingDetail, MeResponse, MyListing } from "@/lib/api/types";
import { serverAuthFetch, serverUser } from "@/lib/auth/serverSession";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("meta.profileTitle"),
  description: t("meta.profileTitle"),
  path: "/profile",
  noIndex: true,
});

// Личная страница: всегда свежая, без кэша
export const dynamic = "force-dynamic";

// Защита: middleware (нет cookie → /login) + ProtectedRoute (сессия истекла → /login)
export default async function ProfilePage({ searchParams }: { searchParams?: { tab?: string } }) {
  // SSR без кэша: профиль с токеном из httpOnly cookie. Не вышло (access истёк) — догрузит браузер
  // Данные открытой вкладки — тоже сразу, чтобы не было скелетона и сдвига вёрстки
  const tab = searchParams?.tab ?? "listings";
  const role = tab === "incoming" ? "owner" : "renter";
  const [profile, user, listings, bookings] = await Promise.all([
    serverAuthFetch<MeResponse>("/users/me"),
    serverUser(),
    tab === "listings" ? serverAuthFetch<MyListing[]>("/users/me/listings") : null,
    tab === "bookings" || tab === "incoming"
      ? serverAuthFetch<BookingDetail[]>(`/bookings?role=${role}&limit=50`)
      : null,
  ]);
  return (
    <ProtectedRoute fallback={<ProfileSkeleton />} ready={Boolean(profile)}>
      <ProfileView
        initialTab={tab}
        initialProfile={profile}
        memberSince={user?.created_at ?? null}
        initialListings={listings}
        initialBookings={bookings ? { role, items: bookings } : null}
      />
    </ProtectedRoute>
  );
}
