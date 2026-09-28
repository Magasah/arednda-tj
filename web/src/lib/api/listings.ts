import { apiClient, bffClient, type ApiClient } from "./client";
import type {
  BusyPeriod,
  Category,
  ListingDetail,
  ListingPage,
  ListingQuery,
  ListingUpdate,
  MyListing,
} from "./types";

// Публичные данные: в браузере — напрямую в backend, на сервере — передаётся serverApi().
// Изменения — через BFF /api/proxy (токен из httpOnly cookie + CSRF)

export const LISTINGS_PAGE_SIZE = 12;

export function getListings(query: ListingQuery = {}, client: ApiClient = apiClient) {
  return client.request<ListingPage>("/listings", {
    query: { limit: LISTINGS_PAGE_SIZE, ...query },
    next: { revalidate: 60 },
  });
}

export function getListing(id: string, client: ApiClient = apiClient) {
  return client.request<ListingDetail>(`/listings/${encodeURIComponent(id)}`, {
    next: { revalidate: 60 },
  });
}

/** Свежая карточка без кэша (редактирование, после изменений) */
export function getListingFresh(id: string) {
  return apiClient.request<ListingDetail>(`/listings/${encodeURIComponent(id)}`, { cache: "no-store" });
}

export function getCategories(client: ApiClient = apiClient) {
  return client.request<Category[]>("/listings/categories", { next: { revalidate: 3600 } });
}

export function getBusyDates(id: string) {
  return apiClient.request<BusyPeriod[]>(`/listings/${encodeURIComponent(id)}/busy-dates`, {
    cache: "no-store",
  });
}

export function getMyListings() {
  return apiClient.request<MyListing[]>("/users/me/listings", { auth: true, cache: "no-store" });
}

const proxy = (path: string) => `/api/proxy/${path}`;

export function createListing(form: FormData) {
  return bffClient.request<ListingDetail>(proxy("listings"), { method: "POST", body: form });
}

export function updateListing(id: string, data: ListingUpdate) {
  return bffClient.request<ListingDetail>(proxy(`listings/${id}`), { method: "PATCH", body: data });
}

/** Скрыть (inactive) или вернуть в ленту (active) */
export function setListingStatus(id: string, status: "active" | "inactive") {
  return updateListing(id, { status });
}

export function deleteListing(id: string) {
  return bffClient.request<void>(proxy(`listings/${id}`), { method: "DELETE" });
}

export function addListingPhotos(id: string, files: File[]) {
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  return bffClient.request<ListingDetail>(proxy(`listings/${id}/photos`), { method: "POST", body: form });
}

export function removeListingPhoto(id: string, index: number) {
  return bffClient.request<ListingDetail>(proxy(`listings/${id}/photos/${index}`), { method: "DELETE" });
}
