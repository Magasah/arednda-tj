import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { t } from "@/lib/i18n";

import { ListingCardSkeleton } from "./ListingCard";
import { gridClasses } from "./grid";

export function CatalogSkeleton() {
  return (
    <Container className="py-6 lg:py-10">
      <span className="sr-only" role="status">
        {t("common.loading")}
      </span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-9 w-72 max-w-full" />
      <Skeleton className="mt-6 h-12 w-full rounded-[12px]" />
      <div className="mt-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-28 shrink-0 rounded-chip" />
        ))}
      </div>
      <ul className={`${gridClasses} mt-10`}>
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ul>
    </Container>
  );
}
