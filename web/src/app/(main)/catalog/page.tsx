import type { Metadata } from "next";

import { CatalogView } from "@/components/listing/CatalogView";
import { getCategories, getListings } from "@/lib/api/listings";
import { serverApi } from "@/lib/api/server";
import { parseFilters } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

interface CatalogPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export const metadata: Metadata = pageMetadata({
  title: t("meta.catalogTitle"),
  description: t("meta.catalogDescription"),
  path: "/catalog",
});

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const api = serverApi();
  const filters = parseFilters(searchParams);
  const [categories, page] = await Promise.allSettled([getCategories(api), getListings(filters, api)]);

  return (
    <CatalogView
      categories={categories.status === "fulfilled" ? categories.value : []}
      category={null}
      filters={filters}
      page={page.status === "fulfilled" ? page.value : null}
    />
  );
}
