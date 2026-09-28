"use server";

import { revalidatePath } from "next/cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Сбросить ISR-кэш карточки после изменения (иначе до 60 с видна старая версия).
 * Данных не меняет и ничего не раскрывает; id проверяем, чтобы не сбрасывать произвольные пути
 */
export async function revalidateListing(id: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  revalidatePath(`/listing/${id}`);
  revalidatePath("/catalog");
}
