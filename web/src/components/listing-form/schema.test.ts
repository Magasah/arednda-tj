import { describe, expect, it } from "vitest";

import { clearDraft, loadDraft, saveDraft } from "./draft";
import { move } from "./photos";
import { emptyValues, listingSchema, toFormData } from "./schema";

const valid = {
  ...emptyValues,
  category_slug: "photo",
  title: "Canon EOS R6",
  price_per_day: "150",
  deposit_amount: "2000",
};

describe("форма объявления (zod)", () => {
  it("валидная форма проходит", () => {
    expect(listingSchema.safeParse(valid).success).toBe(true);
  });

  it("ошибки: короткое название, цена < 1, чужой город", () => {
    const result = listingSchema.safeParse({ ...valid, title: "Ca", price_per_day: "0", city: "Москва" });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((issue) => issue.message);
    expect(messages).toContain("Не короче 3 символов");
    expect(messages).toContain("Минимум 1 сом");
    expect(messages).toContain("Выберите город");
  });

  it("описание до 2000 символов, цена с запятой", () => {
    expect(listingSchema.safeParse({ ...valid, description: "x".repeat(2001) }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, price_per_day: "99,50" }).success).toBe(true);
  });

  it("multipart для API: запятая → точка, координаты только парой", () => {
    const form = toFormData({ ...valid, price_per_day: "99,5", lat: 38.5, lng: 68.7 });
    expect(form.get("price_per_day")).toBe("99.5");
    expect(form.get("lat")).toBe("38.5");
    expect(toFormData(valid).has("lat")).toBe(false);
  });
});

describe("черновик в sessionStorage", () => {
  it("сохраняется и восстанавливается", () => {
    saveDraft({ values: valid, step: 3 });
    expect(loadDraft()).toEqual({ values: valid, step: 3 });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it("подменённый черновик отбрасывается", () => {
    window.sessionStorage.setItem("kiroya:listing-draft", JSON.stringify({ values: { title: 42 }, step: 99 }));
    expect(loadDraft()).toBeNull();
  });
});

describe("порядок фото", () => {
  it("move переставляет, выход за границы — без изменений", () => {
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
