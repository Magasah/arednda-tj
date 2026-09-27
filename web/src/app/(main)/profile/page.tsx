import type { Metadata } from "next";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProfileSkeleton, ProfileView } from "@/components/profile/ProfileView";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("meta.profileTitle"),
  description: t("meta.profileTitle"),
  path: "/profile",
  noIndex: true,
});

// Защита: middleware (нет cookie → /login) + ProtectedRoute (сессия истекла → /login)
export default function ProfilePage() {
  return (
    <ProtectedRoute fallback={<ProfileSkeleton />}>
      <ProfileView />
    </ProtectedRoute>
  );
}
