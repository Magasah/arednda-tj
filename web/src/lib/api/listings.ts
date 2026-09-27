import { apiClient, type ApiClient } from "./client";
import type { Category, ListingDetail, ListingPage, ListingQuery } from "./types";

// Публичные данные: в браузере — напрямую в backend, на сервере — передаётся serverApi()

export const LISTINGS_PAGE_SIZE = 12;

export function getListings(query: ListingQuery = {}, client: ApiClient = apiClient) {
  return client.request<ListingPage>("/listings", {
    query: { limit: LISTINGS_PAGE_SIZE, ...query },
    next: { revalidate: 30 },
  });
}

export function getListing(id: string, client: ApiClient = apiClient) {
  return client.request<ListingDetail>(`/listings/${encodeURIComponent(id)}`, {
    next: { revalidate: 60 },
  });
}

export function getCategories(client: ApiClient = apiClient) {
  return client.request<Category[]>("/listings/categories", { next: { revalidate: 3600 } });
}
