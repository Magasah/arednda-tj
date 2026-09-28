import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { t } from "@/lib/i18n";

export default function ListingLoading() {
  return (
    <Container className="py-6 lg:py-10">
      <span className="sr-only" role="status">
        {t("common.loading")}
      </span>
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        <Skeleton className="aspect-[4/3] w-full rounded-card" />
        <div className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-1/2" />
          <Skeleton className="h-24 w-full rounded-[12px]" />
          <Skeleton className="h-12 w-full rounded-[14px]" />
        </div>
      </div>
    </Container>
  );
}
