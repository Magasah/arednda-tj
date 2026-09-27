import { describe, expect, it } from "vitest";

import { formatMoney, formatMonthYear, formatPhoneInput, isValidTjPhone, maskPhone, toE164 } from "./format";
import { plural } from "./i18n";

describe("телефон", () => {
  it("маска, E.164 и валидация: 13 символов, начинается с +992", () => {
    expect(formatPhoneInput("+992900123456")).toBe("+992 90 012 34 56");
    expect(toE164("+992 90 012 34 56")).toBe("+992900123456");
    expect(toE164("+992 90 012 34 56")).toHaveLength(13);
    expect(isValidTjPhone("+992 90 012 34 5")).toBe(false);
    expect(isValidTjPhone("900123456")).toBe(true);
    expect(maskPhone("900123456")).toBe("+992 90 *** ** 56");
  });

  it("стёртый префикс и вставка номера целиком не портят цифры абонента", () => {
    expect(formatPhoneInput("9")).toBe("+992 9");
    expect(formatPhoneInput("+992 9")).toBe("+992 9");
    expect(toE164("992900123456")).toBe("+992900123456");
    expect(toE164("+992 992 123 456")).toBe("+992992123456");
  });

  it("курсор перед префиксом (мобильные) и вставка полного номера поверх префикса", () => {
    expect(formatPhoneInput("9+992 ")).toBe("+992 9");
    expect(formatPhoneInput("90+992 ")).toBe("+992 90");
    expect(formatPhoneInput("+992 +992 90 012 34 56")).toBe("+992 90 012 34 56");
  });
});

describe("деньги и склонения", () => {
  it("formatMoney и plural", () => {
    expect(formatMoney("1500.00")).toBe("1 500");
    expect(formatMonthYear("2026-09-01T10:00:00Z")).toBe("сентября 2026 г.");
    expect(plural(1, ["отзыв", "отзыва", "отзывов"])).toBe("отзыв");
    expect(plural(3, ["отзыв", "отзыва", "отзывов"])).toBe("отзыва");
    expect(plural(11, ["отзыв", "отзыва", "отзывов"])).toBe("отзывов");
    expect(plural(56, ["отзыв", "отзыва", "отзывов"])).toBe("отзывов");
  });
});
