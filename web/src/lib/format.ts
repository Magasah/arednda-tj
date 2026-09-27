import { locale } from "@/lib/i18n";

const moneyFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

/** "1500.00" → "1 500" (backend отдаёт Decimal строкой) */
export function formatMoney(value: string | number): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(amount) ? moneyFormat.format(amount).replace(/ /g, " ") : "0";
}

export function formatRating(value: number | string | null | undefined): string {
  const rating = typeof value === "string" ? Number.parseFloat(value) : value;
  return rating == null || !Number.isFinite(rating) ? "—" : rating.toFixed(1);
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, options ?? { day: "numeric", month: "long", year: "numeric" });
}

/** «с сентября 2026 г.»: месяц в родительном падеже (Intl даёт его только вместе с числом) */
export function formatMonthYear(value: string): string {
  return formatDate(value, { day: "numeric", month: "long", year: "numeric" }).replace(/^\d+\s/, "");
}

// --- Телефон Таджикистана: +992 XX XXX XX XX -------------------------------------------

const TJ_PREFIX = "+992";
export const TJ_PHONE_LENGTH = 13; // +992 и 9 цифр

/**
 * Только 9 цифр абонента из того, что сейчас в поле.
 * Префикс «+992» вырезаем, где бы он ни оказался: на телефоне курсор часто стоит перед ним,
 * и первая цифра попадает в начало («9+992 »). Остаётся больше 9 цифр и в начале «992» —
 * это код страны (вставили полный номер поверх префикса), его тоже отрезаем.
 */
export function phoneDigits(input: string): string {
  const at = input.indexOf(TJ_PREFIX);
  const withoutPrefix = at === -1 ? input : input.slice(0, at) + input.slice(at + TJ_PREFIX.length);
  let digits = withoutPrefix.replace(/\D/g, "");
  if (digits.length > 9 && digits.startsWith("992")) digits = digits.slice(3);
  return digits.slice(0, 9);
}

/** Маска ввода: "900123456" → "+992 90 012 34 56" */
export function formatPhoneInput(input: string): string {
  const digits = phoneDigits(input);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return [TJ_PREFIX, ...parts.filter(Boolean)].join(" ");
}

/** E.164 для API: "+992900123456" */
export function toE164(input: string): string {
  return `${TJ_PREFIX}${phoneDigits(input)}`;
}

export function isValidTjPhone(input: string): boolean {
  const e164 = toE164(input);
  return e164.length === TJ_PHONE_LENGTH && /^\+992\d{9}$/.test(e164);
}

/** Частично скрытый номер для экрана кода: +992 90 *** ** 56 */
export function maskPhone(input: string): string {
  const digits = phoneDigits(input);
  if (digits.length < 9) return formatPhoneInput(input);
  return `${TJ_PREFIX} ${digits.slice(0, 2)} *** ** ${digits.slice(7)}`;
}
