// Типы ответов backend (FastAPI / Pydantic). Decimal приходит строкой, UUID и даты — строками

export interface Category {
  id: number;
  slug: string;
  name_ru: string;
  name_tj: string;
  icon: string;
}

export interface UserShort {
  id: string;
  name: string | null;
  avatar_url: string | null;
  trust_score: string;
  is_verified: boolean;
  total_deals: number;
}

export interface ListingCard {
  id: string;
  title: string;
  price_per_day: string;
  deposit_amount: string;
  photos: string[];
  rating_avg: number | null;
  rating_count: number;
  city: string;
  category_slug: string;
  is_verified_owner: boolean;
  owner_id: string;
  created_at: string;
}

export type ListingStatus = "active" | "inactive" | "rented";

export interface ListingDetail extends ListingCard {
  description: string | null;
  lat: number | null;
  lng: number | null;
  status: ListingStatus;
  owner: UserShort;
  is_available: boolean;
  updated_at: string;
}

export interface ListingPage {
  items: ListingCard[];
  total: number;
  page: number;
  pages: number;
}

export interface ListingQuery {
  q?: string;
  category?: string;
  city?: string;
  min_price?: string;
  max_price?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// --- Auth ---------------------------------------------------------------------------------

export interface SendOTPResponse {
  message: string;
  expires_in: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
  is_new_user?: boolean | null;
}

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  avatar_url: string | null;
  trust_score: string;
  is_verified: boolean;
  created_at: string;
}

/** Ответ BFF /api/auth/* клиенту: access-токен для памяти + пользователь. Refresh — только в cookie */
export interface SessionResponse {
  accessToken: string;
  user: AuthUser;
  isNewUser?: boolean;
}

/** /api/auth/session: для гостя accessToken и user — null */
export type SessionState = SessionResponse | { accessToken: null; user: null };

// --- Профиль ------------------------------------------------------------------------------

export interface UserStats {
  total_deals: number;
  disputes: number;
  return_rate_percent: number | null;
}

export interface ReviewsSummary {
  total: number;
  avg: number | null;
  distribution: Record<string, number>;
}

export interface ReviewShort {
  id: string;
  rating: number;
  text: string | null;
  author_name: string | null;
  created_at: string;
}

export interface UserProfile {
  user: UserShort;
  stats: UserStats;
  reviews_summary: ReviewsSummary;
  response_rate: number | null;
  active_listings: ListingCard[];
  recent_reviews: ReviewShort[];
}

export interface MeResponse extends UserProfile {
  phone: string;
  language: "ru" | "tg";
  passport_verified_at: string | null;
  trust_score: string;
  telegram_linked: boolean;
}

// --- Брони --------------------------------------------------------------------------------

export type BookingStatus =
  | "pending"
  | "payment_frozen"
  | "active"
  | "return_pending"
  | "completed"
  | "cancelled"
  | "disputed"
  | "resolved";

export interface BookingListing {
  id: string;
  title: string;
  city: string;
  photo: string | null;
  owner_id: string;
  price_per_day: string;
}

export interface BookingDetail {
  id: string;
  listing: BookingListing;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  days: number;
  total_price: string;
  deposit_amount: string;
  status: BookingStatus;
  created_at: string;
}
