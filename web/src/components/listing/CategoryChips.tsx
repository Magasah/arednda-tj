import Link from "next/link";

import { KiroyaIcon } from "@/components/ui/KiroyaIcon";
import type { Category } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { categoryIcon } from "./categoryIcon";

interface CategoryChipsProps {
  categories: Category[];
  active?: string | null;
  /** Строка фильтров (без category/page), чтобы переключение категории их сохраняло */
  search?: string;
}

export function CategoryChips({ categories, active = null, search = "" }: CategoryChipsProps) {
  const suffix = search ? `?${search}` : "";
  const chips = [
    { slug: null, label: t("catalog.allCategories"), href: `/catalog${suffix}`, icon: "kiroya-key" as const },
    ...categories.map((category) => ({
      slug: category.slug,
      label: category.name_ru,
      href: `/catalog/${category.slug}${suffix}`,
      icon: categoryIcon(category.slug, category.icon),
    })),
  ];

  return (
    <nav aria-label={t("catalog.categoriesLabel")} className="-mx-4 sm:mx-0">
      <ul className="scrollbar-none flex gap-2 overflow-x-auto px-4 sm:flex-wrap sm:overflow-visible sm:px-0">
        {chips.map((chip) => {
          const isActive = chip.slug === active;
          return (
            <li key={chip.href} className="shrink-0">
              {/* Ссылка 44px по высоте (touch target), сам чип — 36px по DESIGN_SYSTEM */}
              <Link
                href={chip.href}
                aria-current={isActive ? "page" : undefined}
                className="group flex min-h-11 items-center rounded-chip focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-chip px-4 text-sm transition-colors",
                    "group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2",
                    isActive
                      ? "bg-primary font-semibold text-surface"
                      : "border border-border bg-surface font-medium text-ink hover:border-primary",
                  )}
                >
                  <KiroyaIcon name={chip.icon} size={16} />
                  {chip.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
