import { ru, type Messages } from "./ru";

// Язык пока один. Когда появятся tj.ts / en.ts — выбор словаря по cookie или сегменту URL
const messages: Messages = ru;

type Primitive = string | number;
type Vars = Record<string, Primitive>;

// "auth.title" | "catalog.found" | … — только ключи со строковым значением
type StringKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? StringKeys<T[K], `${Prefix}${K}.`>
        : never;
}[keyof T & string];

export type TKey = Exclude<StringKeys<Messages>, `content.${string}`>;

function lookup(key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object") return (node as Record<string, unknown>)[part];
    return undefined;
  }, messages);
}

/** Строка интерфейса по ключу: t("auth.getCodeIn", { seconds: 42 }) */
export function t(key: TKey, vars?: Vars): string {
  const value = lookup(key);
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Русское склонение по числу: plural(5, ["отзыв", "отзыва", "отзывов"]) → "отзывов" */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

/** Структурированные тексты страниц (списки, FAQ, разделы соглашений) */
export function content(): Messages["content"] {
  return messages.content;
}

export function messagesOf(): Messages {
  return messages;
}

export const locale = "ru-RU";
