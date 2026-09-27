import { CalendarCheck, CalendarX, MapPin } from "lucide-react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BookButton } from "@/components/listing/BookButton";
import { CopyLinkButton } from "@/components/listing/CopyLinkButton";
import { ListingCard } from "@/components/listing/ListingCard";
import { gridClasses } from "@/components/listing/grid";
import { OwnerCard } from "@/components/listing/OwnerCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { isApiError } from "@/lib/api/errors";
import { getCategories, getListing, getListings } from "@/lib/api/listings";
import { serverApi } from "@/lib/api/server";
import type { Category, ListingCard as ListingCardData, ListingDetail } from "@/lib/api/types";
import { SITE_URL } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { pageMetadata } from "@/lib/metadata";

// Галерея — отдельный чанк; HTML первого фото всё равно рендерится на сервере (LCP)
const ListingGallery = dynamic(
  () => import("@/components/listing/ListingGallery").then((mod) => mod.ListingGallery),
  { loading: () => <Skeleton className="aspect-[4/3] w-full rounded-card" /> },
);

interface ListingPageProps {
  params: { id: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Один запрос на рендер: generateMetadata и страница делят результат */
const loadListing = cache(async (id: string): Promise<ListingDetail | null> => {
  if (!UUID_RE.test(id)) return null;
  try {
    return await getListing(id, serverApi());
  } catch (error) {
    if (isApiError(error) && (error.code === "not_found" || error.code === "validation")) return null;
    throw error;
  }
});

function absoluteImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${SITE_URL}${url}`;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const listing = await loadListing(params.id);
  if (!listing) return { title: t("listing.notFoundTitle"), robots: { index: false } };

  return pageMetadata({
    title: t("meta.listingTitle", { title: listing.title }),
    absoluteTitle: true,
    description: t("meta.listingDescription", {
      title: listing.title,
      price: formatMoney(listing.price_per_day),
      deposit: formatMoney(listing.deposit_amount),
      city: listing.city,
    }),
    path: `/listing/${listing.id}`,
    image: mediaUrl(listing.photos[0]),
  });
}

function productJsonLd(listing: ListingDetail) {
  const images = listing.photos.map((photo) => absoluteImage(mediaUrl(photo))).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description ?? listing.title,
    image: images,
    category: listing.category_slug,
    url: `${SITE_URL}/listing/${listing.id}`,
    offers: {
      "@type": "Offer",
      price: listing.price_per_day,
      priceCurrency: "TJS",
      availability: listing.is_available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: listing.price_per_day,
        priceCurrency: "TJS",
        unitText: "DAY",
      },
      areaServed: listing.city,
    },
    ...(listing.rating_count > 0 && listing.rating_avg != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: listing.rating_avg,
            reviewCount: listing.rating_count,
          },
        }
      : {}),
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const listing = await loadListing(params.id);
  if (!listing) notFound();

  const api = serverApi();
  const [categoriesResult, similarResult] = await Promise.allSettled([
    getCategories(api),
    getListings({ category: listing.category_slug, limit: 5 }, api),
  ]);
  const category: Category | undefined =
    categoriesResult.status === "fulfilled"
      ? categoriesResult.value.find((item) => item.slug === listing.category_slug)
      : undefined;
  const similar: ListingCardData[] =
    similarResult.status === "fulfilled"
      ? similarResult.value.items.filter((item) => item.id !== listing.id).slice(0, 4)
      : [];
  const categoryName = category?.name_ru ?? listing.category_slug;
  const deposit = Number.parseFloat(listing.deposit_amount);

  return (
    <>
      <JsonLd data={productJsonLd(listing)} />
      <Container className="pb-28 pt-6 lg:py-10">
        <Breadcrumbs
          items={[
            { name: t("catalog.title"), href: "/catalog" },
            { name: categoryName, href: `/catalog/${listing.category_slug}` },
            { name: listing.title, href: `/listing/${listing.id}` },
          ]}
        />

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
          <div className="min-w-0">
            <ListingGallery photos={listing.photos} title={listing.title} categorySlug={listing.category_slug} />
          </div>

          <aside className="lg:row-span-2">
            <div className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card lg:sticky lg:top-24">
              <h1 className="text-2xl font-bold leading-tight text-ink sm:text-[28px]">{listing.title}</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="size-4" aria-hidden />
                {listing.city}
              </p>

              <div>
                <p className="text-[32px] font-bold leading-none text-accent">
                  {formatMoney(listing.price_per_day)} {t("common.somoni")}
                  <span className="ml-1 text-base font-semibold">{t("listing.pricePerDay")}</span>
                </p>
              </div>

              <div className="rounded-[12px] bg-deposit-bg p-4">
                <p className="text-sm font-semibold text-ink">{t("listing.deposit")}</p>
                <p className="mt-1 text-2xl font-bold text-accent">
                  {deposit > 0 ? `${formatMoney(deposit)} ${t("common.somoni")}` : t("common.depositNone")}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/80">{t("listing.depositHint")}</p>
              </div>

              <p className="flex items-center gap-2 text-sm font-medium">
                {listing.is_available ? (
                  <>
                    <CalendarCheck className="size-5 text-success" aria-hidden />
                    <span className="text-success">{t("listing.available")}</span>
                  </>
                ) : (
                  <>
                    <CalendarX className="size-5 text-muted" aria-hidden />
                    <span className="text-muted">{t("listing.unavailable")}</span>
                  </>
                )}
              </p>

              {/* На мобиле кнопка — в липкой панели снизу (всегда под пальцем) */}
              <div className="hidden lg:block">
                <BookButton disabled={listing.status !== "active"} />
              </div>
              <CopyLinkButton />
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            <section aria-labelledby="description-title">
              <h2 id="description-title" className="text-xl font-bold text-ink">
                {t("listing.description")}
              </h2>
              {/* Текст пользователя — обычный текст React (экранируется), без HTML */}
              <p className="mt-3 whitespace-pre-line break-words text-base leading-relaxed text-ink">
                {listing.description || <span className="text-muted-bg">{t("listing.noDescription")}</span>}
              </p>
            </section>

            <section aria-labelledby="owner-title">
              <h2 id="owner-title" className="text-xl font-bold text-ink">
                {t("listing.owner")}
              </h2>
              <div className="mt-3">
                <OwnerCard owner={listing.owner} />
              </div>
            </section>
          </div>
        </div>

        {similar.length > 0 && (
          <section aria-labelledby="similar-title" className="mt-12">
            <h2 id="similar-title" className="text-xl font-bold text-ink sm:text-2xl">
              {t("listing.similar", { category: categoryName })}
            </h2>
            <ul className={`${gridClasses} mt-4`}>
              {similar.map((item) => (
                <li key={item.id}>
                  <ListingCard listing={item} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4">
          <p className="min-w-0 leading-tight">
            <span className="block text-lg font-bold text-accent">
              {t("common.perDay", { price: formatMoney(listing.price_per_day) })}
            </span>
            <span className="block truncate text-xs text-muted">
              {deposit > 0 ? t("common.deposit", { amount: formatMoney(deposit) }) : t("common.depositNone")}
            </span>
          </p>
          <BookButton disabled={listing.status !== "active"} className="shrink-0 px-6" />
        </div>
      </div>
    </>
  );
}
