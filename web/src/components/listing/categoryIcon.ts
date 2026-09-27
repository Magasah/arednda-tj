import { kiroyaIconNames, type KiroyaIconName } from "@/lib/kiroyaIcons";

const bySlug: Record<string, KiroyaIconName> = {
  tech: "kiroya-laptop",
  tools: "kiroya-wrench",
  transport: "kiroya-scooter",
  photo: "kiroya-camera",
  events: "kiroya-tent",
};

/** Иконка категории: из backend (categories.icon) или по slug, иначе ключ KIROYA */
export function categoryIcon(slug: string, icon?: string | null): KiroyaIconName {
  if (icon && (kiroyaIconNames as readonly string[]).includes(icon)) return icon as KiroyaIconName;
  return bySlug[slug] ?? "kiroya-key";
}
