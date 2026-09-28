import { MessageSquare, PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ListingCard } from "@/components/listing/ListingCard";
import { gridClasses } from "@/components/listing/grid";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StatsRow } from "@/components/profile/StatsRow";
import { RatingHistogram } from "@/components/reviews/RatingHistogram";
import { ReviewList } from "@/components/reviews/ReviewList";
import { ReviewPagination } from "@/components/reviews/ReviewPagination";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { isApiError } from "@/lib/api/errors";
import { getUserReviews } from "@/lib/api/reviews";
import { serverApi } from "@/lib/api/server";
import type { ReviewPage, UserProfile } from "@/lib/api/types";
import { getUserProfile } from "@/lib/api/users";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

interface UserPageProps {
  params: { id: string };
  searchParams?: { page?: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadProfile = cache(async (id: string): Promise<UserProfile | null> => {
  if (!UUID_RE.test(id)) return null;
  try {
    return await getUserProfile(id, serverApi());
  } catch (error) {
    if (isApiError(error) && (error.code === "not_found" || error.code === "validation")) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const profile = await loadProfile(params.id);
  if (!profile) return { title: t("user.notFoundTitle"), robots: { index: false } };
  const name = profile.user.name || t("listing.anonymousOwner");
  return pageMetadata({
    title: t("meta.userTitle", { name }),
    description: t("meta.userDescription"),
    path: `/user/${params.id}`,
  });
}

export default async function UserPage({ params, searchParams }: UserPageProps) {
  const profile = await loadProfile(params.id);
  if (!profile) notFound();
  const name = profile.user.name || t("listing.anonymousOwner");
  const page = Math.min(Math.max(1, Number.parseInt(searchParams?.page ?? "1", 10) || 1), 1000);
  const reviews: ReviewPage | null = await getUserReviews(params.id, page, serverApi()).catch(() => null);

  return (
    <div>
      <Container className="py-4">
        <Breadcrumbs items={[{ name, href: `/user/${params.id}` }]} />
      </Container>
      <ProfileHeader
        name={name}
        avatarUrl={profile.user.avatar_url}
        trustScore={profile.user.trust_score}
        reviewsCount={profile.reviews_summary.total}
        isVerified={profile.user.is_verified}
      />
      <Container className="-mt-4 pb-12">
        <StatsRow stats={profile.stats} />
        <section aria-labelledby="user-listings" className="mt-8">
          <h2 id="user-listings" className="text-xl font-bold text-ink">
            {t("user.listings")}
          </h2>
          {profile.active_listings.length > 0 ? (
            <ul className={`${gridClasses} mt-4`}>
              {profile.active_listings.map((listing) => (
                <li key={listing.id}>
                  <ListingCard listing={listing} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-4" icon={<PackageOpen className="size-7" />} title={t("user.listingsEmpty")} />
          )}
        </section>

        <section id="reviews" aria-labelledby="user-reviews" className="mt-10 scroll-mt-24">
          <h2 id="user-reviews" className="text-xl font-bold text-ink">
            {t("reviews.title")}
          </h2>
          {reviews && reviews.total > 0 ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
              <RatingHistogram
                avg={reviews.avg_rating}
                total={reviews.total}
                distribution={reviews.rating_distribution}
              />
              <div>
                <ReviewList items={reviews.items} />
                <ReviewPagination basePath={`/user/${params.id}`} page={reviews.page} pages={reviews.pages} />
              </div>
            </div>
          ) : (
            <EmptyState className="mt-4" icon={<MessageSquare className="size-7" />} title={t("reviews.empty")} />
          )}
        </section>
      </Container>
    </div>
  );
}
