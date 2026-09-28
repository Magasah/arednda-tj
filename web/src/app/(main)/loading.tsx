import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { t } from "@/lib/i18n";

/** Скелет по умолчанию, пока грузится маршрут */
export default function Loading() {
  return (
    <Container className="py-8 lg:py-12">
      <span className="sr-only" role="status">
        {t("common.loading")}
      </span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-10 w-80 max-w-full" />
      <Skeleton className="mt-6 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-3 h-4 w-3/4 max-w-lg" />
      <Skeleton className="mt-10 h-48 w-full rounded-card" />
    </Container>
  );
}
