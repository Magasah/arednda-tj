import { describe, expect, it } from "vitest";

import { parseDay } from "@/lib/dates";

import { availableActions, busyMatchers, calcPrice, dealSteps, overlapsBusy, toApiRange } from "./logic";

describe("логика сделки", () => {
  it("дни аренды включительно → [start, end) для API", () => {
    expect(toApiRange(parseDay("2026-10-03"), parseDay("2026-10-04"))).toEqual({
      start: "2026-10-03",
      end: "2026-10-05",
      days: 2,
    });
    // выбран один день
    expect(toApiRange(parseDay("2026-10-03"), undefined)).toMatchObject({ end: "2026-10-04", days: 1 });
  });

  it("расчёт: аренда × дни + депозит", () => {
    expect(calcPrice("150.00", "2000.00", 3)).toEqual({ days: 3, rent: 450, deposit: 2000, total: 2450 });
  });

  it("занятые дни: день возврата свободен", () => {
    const periods = [{ start_date: "2026-10-05", end_date: "2026-10-08" }];
    const [busy] = busyMatchers(periods);
    expect(busy.from).toEqual(parseDay("2026-10-05"));
    expect(busy.to).toEqual(parseDay("2026-10-07"));
    expect(overlapsBusy("2026-10-03", "2026-10-05", periods)).toBe(false);
    expect(overlapsBusy("2026-10-03", "2026-10-06", periods)).toBe(true);
    expect(overlapsBusy("2026-10-08", "2026-10-10", periods)).toBe(false);
  });

  it("этапы: ✓ Оплата — ● Передача — ○ Возврат", () => {
    expect(dealSteps("pending")).toEqual(["current", "todo", "todo"]);
    expect(dealSteps("payment_frozen")).toEqual(["done", "current", "todo"]);
    expect(dealSteps("return_pending")).toEqual(["done", "done", "current"]);
    expect(dealSteps("completed")).toEqual(["done", "done", "done"]);
  });

  it("действия по статусу и роли", () => {
    expect(availableActions({ status: "pending", reviewed_by_me: false }, "renter")).toEqual(["pay", "cancel"]);
    expect(availableActions({ status: "pending", reviewed_by_me: false }, "owner")).toEqual([]);
    expect(availableActions({ status: "payment_frozen", reviewed_by_me: false }, "renter")).toEqual(["handover"]);
    expect(availableActions({ status: "active", reviewed_by_me: false }, "renter")).toEqual(["return"]);
    expect(availableActions({ status: "return_pending", reviewed_by_me: false }, "owner")).toEqual(["confirm-return"]);
    expect(availableActions({ status: "return_pending", reviewed_by_me: false }, "renter")).toEqual([]);
    expect(availableActions({ status: "completed", reviewed_by_me: false }, "owner")).toEqual(["review"]);
    expect(availableActions({ status: "completed", reviewed_by_me: true }, "owner")).toEqual([]);
  });
});
