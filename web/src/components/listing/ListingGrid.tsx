"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/api/errors";
import { getListings } from "@/lib/api/listings";
import type { ListingCard as ListingCardData, ListingPage, ListingQuery } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { gridClasses } from "./grid";
import { ListingCard, ListingCardSkeleton } from "./ListingCard";

interface ListingGridProps {
  /** Первая страница — отрисована на сервере (SSR) */
  initial: ListingPage;
  query: ListingQuery;
}

/**
 * Сетка объявлений с бесконечной прокруткой: IntersectionObserver следит за «якорем» под сеткой
 * и догружает следующую страницу. Кнопка «Показать ещё» — запасной путь (клавиатура, старые браузеры).
 */
export function ListingGrid({ initial, query }: ListingGridProps) {
  const [items, setItems] = useState<ListingCardData[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [pages, setPages] = useState(initial.pages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);

  const hasMore = page < pages;

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const next = await getListings({ ...query, page: page + 1 });
      setItems((current) => {
        // Новые объявления могли сдвинуть страницы — убираем дубли по id
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...next.items.filter((item) => !seen.has(item.id))];
      });
      setPage(next.page);
      setPages(next.pages);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [hasMore, page, query]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || error || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, error, loadMore]);

  return (
    <div>
      <ul className={gridClasses}>
        {items.map((listing, index) => (
          <li key={listing.id}>
            <ListingCard listing={listing} priority={index < 4} />
          </li>
        ))}
        {loading &&
          Array.from({ length: 4 }, (_, index) => (
            <li key={`skeleton-${index}`}>
              <ListingCardSkeleton />
            </li>
          ))}
      </ul>

      <div ref={sentinel} aria-hidden className="h-px" />

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p aria-live="polite" className={cn("text-sm text-muted-bg", !loading && !error && hasMore && "sr-only")}>
          {loading ? t("catalog.loadingMore") : error ? error : hasMore ? "" : t("catalog.end")}
        </p>
        {hasMore && !loading && (
          <Button variant="outline" size="md" onClick={() => void loadMore()}>
            {error ? t("common.retry") : t("catalog.loadMore")}
          </Button>
        )}
      </div>
    </div>
  );
}
