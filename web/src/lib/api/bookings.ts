import { apiClient, bffClient } from "./client";
import type {
  BookingCreated,
  BookingDetail,
  ConfirmReturnResult,
  PaymentMethod,
  ReturnResult,
} from "./types";

// Чтение — напрямую в backend с Bearer; действия сделки — через BFF /api/proxy (CSRF + httpOnly cookie)

const proxy = (path: string) => `/api/proxy/${path}`;

export function getBooking(id: string) {
  return apiClient.request<BookingDetail>(`/bookings/${encodeURIComponent(id)}`, {
    auth: true,
    cache: "no-store",
  });
}

export function getBookings(role: "renter" | "owner", limit = 50) {
  return apiClient.request<BookingDetail[]>("/bookings", {
    auth: true,
    query: { role, limit },
    cache: "no-store",
  });
}

export function createBooking(listingId: string, startDate: string, endDate: string) {
  return bffClient.request<BookingCreated>(proxy("bookings"), {
    method: "POST",
    body: { listing_id: listingId, start_date: startDate, end_date: endDate },
  });
}

export function cancelBooking(id: string) {
  return bffClient.request<BookingDetail>(proxy(`bookings/${id}/cancel`), { method: "POST" });
}

export function confirmPayment(id: string, method: PaymentMethod) {
  return bffClient.request<{ booking_id: string; escrow_id: string }>(proxy(`bookings/${id}/confirm-payment`), {
    method: "POST",
    body: { payment_method: method },
  });
}

function photoForm(files: File[]) {
  const form = new FormData();
  for (const file of files) form.append("photos", file, file.name);
  return form;
}

/** Фото-акт «до»: арендатор получил вещь */
export function handover(id: string, files: File[]) {
  return bffClient.request<{ status: string }>(proxy(`bookings/${id}/handover`), {
    method: "POST",
    body: photoForm(files),
  });
}

/** Фото-акт «после»: арендатор вернул вещь */
export function returnItem(id: string, files: File[]) {
  return bffClient.request<ReturnResult>(proxy(`bookings/${id}/return`), {
    method: "POST",
    body: photoForm(files),
  });
}

export function confirmReturn(id: string, condition: "good" | "damaged", damageDescription?: string) {
  return bffClient.request<ConfirmReturnResult>(proxy(`bookings/${id}/confirm-return`), {
    method: "POST",
    body: { condition, damage_description: condition === "damaged" ? damageDescription : null },
  });
}
