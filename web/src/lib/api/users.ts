import { apiClient, bffClient, type ApiClient } from "./client";
import type { BookingDetail, MeResponse, UserProfile } from "./types";

export function getUserProfile(id: string, client: ApiClient = apiClient) {
  return client.request<UserProfile>(`/users/${encodeURIComponent(id)}/profile`, {
    next: { revalidate: 60 },
  });
}

export function getMyProfile() {
  return apiClient.request<MeResponse>("/users/me", { auth: true, cache: "no-store" });
}

/** Имя и/или аватар. Изменение — через BFF (CSRF-защита, токен из httpOnly cookie) */
export function updateMyProfile(data: { name?: string; avatar?: File }) {
  const form = new FormData();
  if (data.name !== undefined) form.set("name", data.name);
  if (data.avatar) form.set("avatar", data.avatar);
  return bffClient.request<MeResponse>("/api/users/me", { method: "PATCH", body: form });
}

export function getMyBookings(role: "renter" | "owner" = "renter") {
  return apiClient.request<BookingDetail[]>("/bookings", {
    auth: true,
    query: { role, limit: 20 },
    cache: "no-store",
  });
}

/** Фото паспорта → приватное хранилище backend. Сейчас подтверждается автоматически (заглушка) */
export function verifyPassport(photo: File) {
  const form = new FormData();
  form.set("passport_photo", photo, photo.name);
  return bffClient.request<MeResponse>("/api/proxy/users/me/verify", { method: "POST", body: form });
}
