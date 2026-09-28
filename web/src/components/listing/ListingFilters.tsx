"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FILTER_KEYS, filtersToSearch, validateFilters, type FilterValues } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ListingFiltersProps {
  /** /catalog или /catalog/<категория> */
  basePath: string;
  values: FilterValues;
}

/**
 * Поиск и фильтры. Это обычная GET-форма: работает и без JS (сервер читает ?q=&city=…),
 * а с JS — проверяет поля и переходит без пустых параметров.
 */
export function ListingFilters({ basePath, values }: ListingFiltersProps) {
  const router = useRouter();
  const panelId = useId();
  const hasAdvanced = Boolean(
    values.city || values.min_price || values.max_price || values.date_from || values.date_to,
  );
  const [open, setOpen] = useState(hasAdvanced);
  const [errors, setErrors] = useState<ReturnType<typeof validateFilters>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: FilterValues = {};
    for (const key of FILTER_KEYS) {
      const value = form.get(key);
      if (typeof value === "string" && value.trim()) next[key] = value.trim();
    }
    const found = validateFilters(next);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setOpen(true);
      return;
    }
    const search = filtersToSearch(next);
    router.push(search ? `${basePath}?${search}` : basePath);
  }

  return (
    <form role="search" action={basePath} method="get" onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          name="q"
          type="search"
          label={t("catalog.searchLabel")}
          hideLabel
          placeholder={t("catalog.searchPlaceholder")}
          defaultValue={values.q}
          maxLength={100}
          enterKeyHint="search"
          leading={<Search className="size-5" aria-hidden />}
          containerClassName="flex-1"
        />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? t("catalog.hideFilters") : t("catalog.showFilters")}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-[12px] border transition-colors",
            open || hasAdvanced
              ? "border-primary bg-primary text-surface"
              : "border-border bg-surface text-primary hover:border-primary",
          )}
        >
          <SlidersHorizontal className="size-5" aria-hidden />
        </button>
        <Button type="submit" variant="primary" size="md" className="hidden sm:inline-flex">
          {t("catalog.searchSubmit")}
        </Button>
      </div>

      <fieldset
        id={panelId}
        hidden={!open}
        className={cn(
          "gap-3 rounded-card bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5",
          open ? "grid" : "hidden",
        )}
      >
        <legend className="sr-only">{t("catalog.filters")}</legend>
        <Input
          name="city"
          label={t("catalog.city")}
          placeholder={t("common.city")}
          defaultValue={values.city}
          maxLength={80}
          autoComplete="address-level2"
        />
        <Input
          name="min_price"
          type="number"
          inputMode="numeric"
          min={0}
          label={t("catalog.priceFrom")}
          defaultValue={values.min_price}
          error={errors.min_price}
        />
        <Input
          name="max_price"
          type="number"
          inputMode="numeric"
          min={0}
          label={t("catalog.priceTo")}
          defaultValue={values.max_price}
          error={errors.max_price}
        />
        <Input
          name="date_from"
          type="date"
          label={t("catalog.dateFrom")}
          defaultValue={values.date_from}
          error={errors.date_from}
        />
        <Input
          name="date_to"
          type="date"
          label={t("catalog.dateTo")}
          defaultValue={values.date_to}
          error={errors.date_to}
        />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
          <Button type="submit" variant="primary" size="md" className="flex-1 lg:flex-none">
            {t("catalog.apply")}
          </Button>
          <Button href={basePath} variant="ghost" size="md" className="flex-1 lg:flex-none">
            {t("catalog.reset")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
