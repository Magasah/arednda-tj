import { emptyValues, listingSchema, type ListingFormValues } from "./schema";

// Черновик нового объявления в sessionStorage: переживает перезагрузку и переход между шагами,
// но не остаётся на общем компьютере после закрытия вкладки. Фото (File) не сериализуются — их нет

const KEY = "kiroya:listing-draft";

export interface Draft {
  values: ListingFormValues;
  step: number;
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    // Черновик мог подменить скрипт/расширение — принимаем только поля схемы нужного типа
    const values = listingSchema.partial().safeParse(parsed.values ?? {});
    if (!values.success) return null;
    const step = typeof parsed.step === "number" && parsed.step >= 0 && parsed.step < 6 ? parsed.step : 0;
    return { values: { ...emptyValues, ...values.data }, step };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // хранилище переполнено или запрещено — черновик просто не сохранится
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // нет доступа — нечего чистить
  }
}
