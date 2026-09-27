import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { breadcrumbJsonLd, JsonLd, type BreadcrumbItem } from "@/components/seo/JsonLd";
import { t } from "@/lib/i18n";

interface BreadcrumbsProps {
  /** Без «Главной» — она добавляется сама. Последний пункт — текущая страница */
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const all = [{ name: t("common.home"), href: "/" }, ...items];

  return (
    <>
      <nav aria-label={t("nav.breadcrumbs")} className="text-[13px] text-muted-bg">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((item, index) => {
            const isLast = index === all.length - 1;
            return (
              <li key={item.href} className="flex min-w-0 items-center gap-1">
                {isLast ? (
                  <span aria-current="page" className="truncate font-medium text-ink">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.href} className="inline-flex min-h-11 items-center transition-colors hover:text-primary">
                      {item.name}
                    </Link>
                    <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(all)} />
    </>
  );
}
