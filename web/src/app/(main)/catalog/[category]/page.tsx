import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogView } from "@/components/listing/CatalogView";
import { isApiError } from "@/lib/api/errors";
import { getCategories, getListings } from "@/lib/api/listings";
import { serverApi } from "@/lib/api/server";
import type { Category } from "@/lib/api/types";
import { parseFilters } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

interface CategoryPageProps {
  params: { category: string };
  searchParams: Record<string, string | string[] | undefined>;
}

async function loadCategories(): Promise<Category[] | null> {
  try {
    return await getCategories(serverApi());
  } catch (error) {
    if (isApiError(error) && error.code === "not_found") return [];
    return null;
  }
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const categories = await loadCategories();
  const category = categories?.find((item) => item.slug === params.category);
  const name = category?.name_ru ?? t("catalog.title");
  return pageMetadata({
    title: t("meta.categoryTitle", { category: name }),
    description: t("meta.categoryDescription", { category: name }),
    path: `/catalog/${params.category}`,
  });
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const categories = await loadCategories();
  const category = categories?.find((item) => item.slug === params.category) ?? null;
  // Список категорий получен, а такой нет — это 404; backend недоступен — покажем ошибку в каталоге
  if (categories && !category) notFound();

  const filters = parseFilters(searchParams);
  let page = null;
  try {
    page = await getListings({ ...filters, category: params.category }, serverApi());
  } catch {
    page = null;
  }

  return (
    <CatalogView
      categories={categories ?? []}
      category={category ?? { id: 0, slug: params.category, name_ru: params.category, name_tj: params.category, icon: "" }}
      filters={filters}
      page={page}
    />
  );
}
