import { z } from "zod";

import { messagesOf, t } from "@/lib/i18n";

// Схема формы объявления. Цены — строками (как в поле ввода и в API: Decimal), запятая = точка

export const CITIES = messagesOf().cities;

const money = /^\d{1,10}([.,]\d{1,2})?$/;
export const toNumber = (value: string) => Number.parseFloat(value.replace(",", "."));

export const listingSchema = z.object({
  category_slug: z.string().min(1, t("wizard.categoryRequired")),
  title: z.string().trim().min(3, t("wizard.titleShort")).max(100, t("wizard.titleLong")),
  description: z.string().max(2000, t("wizard.descriptionLong")),
  price_per_day: z
    .string()
    .trim()
    .regex(money, t("wizard.priceInvalid"))
    .refine((value) => toNumber(value) >= 1, t("wizard.priceMin")),
  deposit_amount: z
    .string()
    .trim()
    .regex(money, t("wizard.priceInvalid"))
    .refine((value) => toNumber(value) >= 0, t("wizard.depositMin")),
  city: z.string().refine((value) => (CITIES as readonly string[]).includes(value), t("wizard.cityRequired")),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

export type ListingFormValues = z.infer<typeof listingSchema>;

export const emptyValues: ListingFormValues = {
  category_slug: "",
  title: "",
  description: "",
  price_per_day: "",
  deposit_amount: "0",
  city: "Душанбе",
  lat: null,
  lng: null,
};

/** Какие поля проверяет каждый шаг (фото и превью проверяются отдельно) */
export const STEP_FIELDS: (keyof ListingFormValues)[][] = [
  ["category_slug"],
  ["title", "description"],
  ["price_per_day", "deposit_amount"],
  ["city", "lat", "lng"],
  [],
  [],
];

export const STEP_COUNT = STEP_FIELDS.length;
export const PHOTOS_STEP = 4;

/** "150,5" → "150.5" для API */
export function normalizeMoney(value: string): string {
  return value.trim().replace(",", ".");
}

/** Поля формы → multipart для POST /listings (фото добавляет вызывающий) */
export function toFormData(values: ListingFormValues): FormData {
  const form = new FormData();
  form.set("category_slug", values.category_slug);
  form.set("title", values.title.trim());
  if (values.description.trim()) form.set("description", values.description.trim());
  form.set("price_per_day", normalizeMoney(values.price_per_day));
  form.set("deposit_amount", normalizeMoney(values.deposit_amount || "0"));
  form.set("city", values.city);
  if (values.lat != null && values.lng != null) {
    form.set("lat", String(values.lat));
    form.set("lng", String(values.lng));
  }
  return form;
}
