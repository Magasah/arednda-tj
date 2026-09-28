import { mediaUrl } from "@/lib/media";

// Фото в мастере объявления: общий тип и помощники (без UI — чтобы не тянуть загрузчик в общий чанк)

export const MAX_PHOTOS = 8;

/** Новое фото (ещё в браузере) или уже загруженное (URL из backend, при редактировании) */
export type PhotoItem =
  | { id: string; kind: "new"; file: File; preview: string }
  | { id: string; kind: "existing"; url: string };

export function photoSrc(item: PhotoItem): string | null {
  return item.kind === "new" ? item.preview : mediaUrl(item.url);
}

/** Освободить object URL превью (при удалении и уходе со страницы) */
export function revokePreviews(items: PhotoItem[]) {
  for (const item of items) if (item.kind === "new") URL.revokeObjectURL(item.preview);
}

let counter = 0;
export const nextPhotoId = () => `photo-${Date.now()}-${(counter += 1)}`;

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
