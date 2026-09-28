import { describe, expect, it } from "vitest";

import { formatLongDate, formatRelative, parseDay, rentalDays, toDay } from "./dates";

describe("даты по-русски (date-fns ru)", () => {
  it("«24 сентября 2026» без сдвига часового пояса", () => {
    expect(formatLongDate("2026-09-24")).toBe("24 сентября 2026");
    expect(toDay(parseDay("2026-09-24"))).toBe("2026-09-24");
  });

  it("относительное время: «через 3 дня» и «2 часа назад»", () => {
    const now = new Date("2026-09-24T12:00:00");
    expect(formatRelative(new Date("2026-09-27T12:00:00"), now)).toBe("через 3 дня");
    expect(formatRelative(new Date("2026-09-24T10:00:00"), now)).toBe("2 часа назад");
  });

  it("сутки аренды: день возврата не оплачивается", () => {
    expect(rentalDays(parseDay("2026-10-01"), parseDay("2026-10-04"))).toBe(3);
  });
});
