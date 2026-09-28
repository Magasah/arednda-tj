import { addDays } from "date-fns";

import type { BookingDetail, BookingStatus, BusyPeriod } from "@/lib/api/types";
import { parseDay, rentalDays, toDay } from "@/lib/dates";

// Правила сделки без UI: расчёт суммы, этапы и доступные действия. Покрыты тестами

export const MAX_RENTAL_DAYS = 30;

/**
 * Пользователь выбирает дни аренды включительно (3–4 октября = 2 дня),
 * API ждёт [start_date, end_date): end_date — день возврата (5 октября), он не оплачивается
 */
export function toApiRange(from: Date, to: Date | undefined): { start: string; end: string; days: number } {
  const last = to ?? from;
  const returnDay = addDays(last, 1);
  return { start: toDay(from), end: toDay(returnDay), days: rentalDays(from, returnDay) };
}

export interface PriceBreakdown {
  days: number;
  rent: number;
  deposit: number;
  total: number;
}

export function calcPrice(pricePerDay: string | number, deposit: string | number, days: number): PriceBreakdown {
  const price = typeof pricePerDay === "number" ? pricePerDay : Number.parseFloat(pricePerDay);
  const dep = typeof deposit === "number" ? deposit : Number.parseFloat(deposit);
  const rent = Math.round(price * days * 100) / 100;
  const safeDeposit = Number.isFinite(dep) ? dep : 0;
  return { days, rent, deposit: safeDeposit, total: Math.round((rent + safeDeposit) * 100) / 100 };
}

/** Занятые периоды → занятые дни для календаря: [start, end) → start … end-1 */
export function busyMatchers(periods: BusyPeriod[]): { from: Date; to: Date }[] {
  return periods.map((period) => ({
    from: parseDay(period.start_date),
    to: addDays(parseDay(period.end_date), -1),
  }));
}

/** Пересекает ли выбранный период занятые дни */
export function overlapsBusy(start: string, end: string, periods: BusyPeriod[]): boolean {
  return periods.some((period) => period.start_date < end && start < period.end_date);
}

export type StepState = "done" | "current" | "todo";

/** Этапы «Оплата — Передача — Возврат» для статуса брони */
export function dealSteps(status: BookingStatus): [StepState, StepState, StepState] {
  switch (status) {
    case "pending":
      return ["current", "todo", "todo"];
    case "payment_frozen":
      return ["done", "current", "todo"];
    case "active":
    case "return_pending":
      return ["done", "done", "current"];
    case "completed":
    case "resolved":
      return ["done", "done", "done"];
    case "disputed":
      return ["done", "done", "current"];
    default:
      return ["todo", "todo", "todo"];
  }
}

export type DealRole = "renter" | "owner";

export type DealAction = "pay" | "cancel" | "handover" | "return" | "confirm-return" | "review";

/** Что может сделать участник сейчас */
export function availableActions(booking: Pick<BookingDetail, "status" | "reviewed_by_me">, role: DealRole): DealAction[] {
  switch (booking.status) {
    case "pending":
      return role === "renter" ? ["pay", "cancel"] : [];
    case "payment_frozen":
      return role === "renter" ? ["handover"] : [];
    case "active":
      return role === "renter" ? ["return"] : [];
    case "return_pending":
      return role === "owner" ? ["confirm-return"] : [];
    case "completed":
      return booking.reviewed_by_me ? [] : ["review"];
    default:
      return [];
  }
}

/** Сумма к оплате = аренда + депозит (замораживаются на эскроу) */
export function amountToPay(booking: Pick<BookingDetail, "total_price" | "deposit_amount">): number {
  return Number.parseFloat(booking.total_price) + Number.parseFloat(booking.deposit_amount);
}
