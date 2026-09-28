import { apiClient, bffClient, type ApiClient } from "./client";
import type { ReviewCreated, ReviewPage } from "./types";

export const REVIEWS_PAGE_SIZE = 10;

export function getUserReviews(userId: string, page = 1, client: ApiClient = apiClient) {
  return client.request<ReviewPage>(`/reviews/user/${encodeURIComponent(userId)}`, {
    query: { page, limit: REVIEWS_PAGE_SIZE },
    next: { revalidate: 60 },
  });
}

export function getListingReviews(listingId: string, client: ApiClient = apiClient, limit = 5) {
  return client.request<ReviewPage>(`/reviews/listing/${encodeURIComponent(listingId)}`, {
    query: { page: 1, limit },
    next: { revalidate: 60 },
  });
}

export function createReview(bookingId: string, rating: number, text: string) {
  return bffClient.request<ReviewCreated>("/api/proxy/reviews", {
    method: "POST",
    body: { booking_id: bookingId, rating, text: text.trim() || null },
  });
}
