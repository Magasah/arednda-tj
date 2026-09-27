import { SearchX, ServerCrash } from "lucide-react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Category, ListingPage, ListingQuery } from "@/lib/api/types";
import { filtersToSearch, type FilterValues } from "@/lib/catalog";
import { t } from "@/lib/i18n";

import { CategoryChips } from "./CategoryChips";
import { ListingFilters } from "./ListingFilters";
import { ListingGrid } from "./ListingGrid";

interface CatalogViewProps {
  categories: Category[];
  category: Category | null;
  filters: FilterValues;
  /** null — backend недоступен */
  page: ListingPage | null;
}

export function CatalogView({ categories, category, filters, page }: CatalogViewProps) {
  const basePath = category ? `/catalog/${category.slug}` : "/catalog";
  const search = filtersToSearch(filters);
  const query: ListingQuery = { ...filters, category: category?.slug };
  const crumbs = category
    ? [
        { name: t("catalog.title"), href: "/catalog" },
        { name: category.name_ru, href: basePath },
      ]
    : [{ name: t("catalog.title"), href: "/catalog" }];

  return (
    <Container className="py-6 lg:py-10">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-primary sm:text-4xl">
        {category ? t("catalog.categoryHeading", { category: category.name_ru }) : t("catalog.heading")}
      </h1>

      <div className="mt-6 flex flex-col gap-4">
        <ListingFilters key={`${basePath}?${search}`} basePath={basePath} values={filters} />
        {categories.length > 0 && <CategoryChips categories={categories} active={category?.slug ?? null} search={search} />}
      </div>

      <section aria-labelledby="catalog-results" className="mt-6">
        <h2 id="catalog-results" className="sr-only">
          {t("catalog.results")}
        </h2>
        {page === null ? (
          <EmptyState
            tone="error"
            icon={<ServerCrash className="size-7" />}
            title={t("catalog.errorTitle")}
            text={t("catalog.errorText")}
            action={
              <Button href={search ? `${basePath}?${search}` : basePath} variant="primary" size="md">
                {t("common.retry")}
              </Button>
            }
          />
        ) : page.total === 0 ? (
          <EmptyState
            icon={<SearchX className="size-7" />}
            title={t("catalog.emptyTitle")}
            text={t("catalog.emptyText")}
            action={
              <Button href="/catalog" variant="primary" size="md">
                {t("catalog.reset")}
              </Button>
            }
          />
        ) : (
          <>
            <p aria-live="polite" className="mb-4 text-sm text-muted-bg">
              {t("catalog.found", { count: page.total })}
            </p>
            {/* key: новые фильтры = новая лента с первой страницы */}
            <ListingGrid key={`${basePath}?${search}`} initial={page} query={query} />
          </>
        )}
      </section>
    </Container>
  );
}
