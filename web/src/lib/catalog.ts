import type { ListingQuery } from "@/lib/api/types";
import { t } from "@/lib/i18n";

// Общие для сервера и клиента функции каталога (без "use client": их зовут и серверные страницы)

export type FilterValues = Pick<ListingQuery, "q" | "city" | "min_price" | "max_price" | "date_from" | "date_to">;

export const FILTER_KEYS = ["q", "city", "min_price", "max_price", "date_from", "date_to"] as const;

/** Проверка перед переходом: backend всё равно вернёт 422, но так ошибка понятнее и рядом с полем */
export function validateFilters(values: FilterValues): Partial<Record<keyof FilterValues, string>> {
  const errors: Partial<Record<keyof FilterValues, string>> = {};
  if (values.date_from && values.date_to && values.date_to <= values.date_from) {
    errors.date_to = t("catalog.datesInvalid");
  }
  if ((values.date_from && !values.date_to) || (!values.date_from && values.date_to)) {
    errors[values.date_from ? "date_to" : "date_from"] = t("catalog.datesInvalid");
  }
  const min = values.min_price ? Number(values.min_price) : null;
  const max = values.max_price ? Number(values.max_price) : null;
  if (min !== null && max !== null && max < min) errors.max_price = t("catalog.priceInvalid");
  return errors;
}

export function filtersToSearch(values: FilterValues): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = values[key]?.trim();
    if (value) params.set(key, value);
  }
  return params.toString();
}

type SearchParams = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRICE_RE = /^\d{1,10}(\.\d{1,2})?$/;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * ?q=&city=… → фильтры для backend. Неверные значения отбрасываем, а не шлём в API:
 * иначе ручная правка URL давала бы 422 вместо страницы каталога.
 */
export function parseFilters(searchParams: SearchParams): FilterValues {
  const filters: FilterValues = {};
  const q = first(searchParams.q);
  if (q) filters.q = q.slice(0, 100);
  const city = first(searchParams.city);
  if (city && city.length >= 2) filters.city = city.slice(0, 80);

  const min = first(searchParams.min_price);
  const max = first(searchParams.max_price);
  if (min && PRICE_RE.test(min)) filters.min_price = min;
  if (max && PRICE_RE.test(max)) filters.max_price = max;
  if (filters.min_price && filters.max_price && Number(filters.max_price) < Number(filters.min_price)) {
    delete filters.max_price;
  }

  const from = first(searchParams.date_from);
  const to = first(searchParams.date_to);
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to) && to > from) {
    filters.date_from = from;
    filters.date_to = to;
  }
  return filters;
}
