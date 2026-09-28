import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ReviewPaginationProps {
  basePath: string;
  page: number;
  pages: number;
  /** Якорь блока отзывов — после перехода остаёмся на нём */
  anchor?: string;
}

const linkClasses =
  "flex size-11 items-center justify-center rounded-full border border-border bg-surface text-primary transition-colors hover:bg-primary/5";

/** Страницы отзывов обычными ссылками ?page=N — работает без JS и индексируется */
export function ReviewPagination({ basePath, page, pages, anchor = "reviews" }: ReviewPaginationProps) {
  if (pages <= 1) return null;
  const href = (target: number) => `${basePath}${target > 1 ? `?page=${target}` : ""}#${anchor}`;

  return (
    <nav aria-label={t("reviews.title")} className="mt-4 flex items-center justify-center gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} scroll={false} aria-label={t("reviews.prev")} className={linkClasses}>
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className={cn(linkClasses, "pointer-events-none opacity-40")}>
          <ChevronLeft className="size-5" />
        </span>
      )}
      <span className="text-sm font-medium text-ink" aria-current="page">
        {t("reviews.page", { page, pages })}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} scroll={false} aria-label={t("reviews.next")} className={linkClasses}>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className={cn(linkClasses, "pointer-events-none opacity-40")}>
          <ChevronRight className="size-5" />
        </span>
      )}
    </nav>
  );
}
