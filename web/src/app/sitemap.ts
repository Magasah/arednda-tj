import type { MetadataRoute } from "next";

import { getCategories, getListings } from "@/lib/api/listings";
import { serverApi } from "@/lib/api/server";
import { SITE_URL } from "@/lib/env";

// Генерируется по запросу (при docker build backend недоступен — статика бы «застыла» без объявлений).
// Ответы backend кэшируются на уровне fetch (см. lib/api/listings). Если backend лежит — только статика
export const dynamic = "force-dynamic";

const MAX_PAGES = 40; // 40 × 50 = до 2000 объявлений; больше — разбить на несколько sitemap

const staticPages: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/catalog", priority: 0.9, changeFrequency: "daily" },
  { path: "/how-it-works", priority: 0.6, changeFrequency: "monthly" },
  { path: "/safety", priority: 0.6, changeFrequency: "monthly" },
  { path: "/help", priority: 0.5, changeFrequency: "monthly" },
  { path: "/about", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.2, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const api = serverApi();
  try {
    const categories = await getCategories(api);
    for (const category of categories) {
      entries.push({
        url: `${SITE_URL}/catalog/${category.slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await getListings({ page, limit: 50 }, api);
      for (const listing of result.items) {
        entries.push({
          url: `${SITE_URL}/listing/${listing.id}`,
          lastModified: new Date(listing.created_at),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
      if (page >= result.pages) break;
    }
  } catch {
    // backend недоступен — только статические страницы
  }
  return entries;
}
