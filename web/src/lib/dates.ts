import { addDays, differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

// Даты для интерфейса: «24 сентября 2026», «через 3 дня», «2 часа назад».
// Даты брони приходят как "YYYY-MM-DD" без часового пояса — разбираем их как локальные

/** "2026-09-24" → Date (локальная полночь), без сдвига на UTC */
export function parseDay(value: string): Date {
  return parseISO(value.slice(0, 10));
}

/** Date → "2026-09-24" в локальном времени (для API) */
export function toDay(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** «24 сентября 2026» */
export function formatLongDate(value: string | Date): string {
  const date = typeof value === "string" ? (value.length === 10 ? parseDay(value) : parseISO(value)) : value;
  return Number.isNaN(date.getTime()) ? String(value) : format(date, "d MMMM yyyy", { locale: ru });
}

/** «24 сент.» — компактно для списков */
export function formatShortDate(value: string | Date): string {
  const date = typeof value === "string" ? parseDay(value) : value;
  return format(date, "d MMM", { locale: ru });
}

/** «24 сентября, 14:05» */
export function formatDateTime(value: string): string {
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "d MMMM, HH:mm", { locale: ru });
}

/** «через 3 дня» / «2 часа назад» */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  // formatDistanceToNowStrict считает от Date.now — сдвигаем на разницу с переданным now (для тестов)
  const shifted = new Date(date.getTime() + (Date.now() - now.getTime()));
  return formatDistanceToNowStrict(shifted, { locale: ru, addSuffix: true });
}

/** Сутки аренды между днём получения и днём возврата (день возврата не оплачивается) */
export function rentalDays(start: Date, end: Date): number {
  return Math.max(0, differenceInCalendarDays(end, start));
}

export function tomorrow(now: Date = new Date()): Date {
  const date = addDays(now, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}
