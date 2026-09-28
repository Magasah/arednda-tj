"use client";

import { CalendarRange, Inbox } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { StatusBadge } from "@/components/booking/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getBookings } from "@/lib/api/bookings";
import { errorMessage } from "@/lib/api/errors";
import type { BookingDetail, BookingStatus } from "@/lib/api/types";
import { formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "done";

const ACTIVE: BookingStatus[] = ["pending", "payment_frozen", "active", "return_pending", "disputed"];

export function matchesFilter(status: BookingStatus, filter: Filter): boolean {
  if (filter === "all") return true;
  return filter === "active" ? ACTIVE.includes(status) : !ACTIVE.includes(status);
}

interface BookingsTabProps {
  /** renter — я арендую, owner — бронируют мои вещи */
  role: "renter" | "owner";
  /** Загружено на сервере (SSR), если вкладка открыта сразу */
  initial?: BookingDetail[] | null;
}

export function BookingsTab({ role, initial = null }: BookingsTabProps) {
  const [bookings, setBookings] = useState<BookingDetail[] | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(() => {
    setError(null);
    getBookings(role)
      .then(setBookings)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [role]);

  const hasInitial = initial !== null;
  useEffect(() => {
    if (!hasInitial) load();
  }, [hasInitial, load]);

  if (error) {
    return (
      <EmptyState
        tone="error"
        title={t("errors.generic")}
        text={error}
        action={
          <Button variant="primary" size="md" onClick={load}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  if (!bookings) {
    return (
      <ul className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index}>
            <Skeleton className="h-24 w-full rounded-card" />
          </li>
        ))}
      </ul>
    );
  }

  if (bookings.length === 0) {
    return role === "renter" ? (
      <EmptyState
        icon={<CalendarRange className="size-7" aria-hidden />}
        title={t("profile.bookingsEmptyTitle")}
        text={t("profile.bookingsEmptyText")}
        action={
          <Button href="/catalog" variant="primary" size="md">
            {t("profile.goToCatalog")}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<Inbox className="size-7" aria-hidden />}
        title={t("account.incomingEmptyTitle")}
        text={t("account.incomingEmptyText")}
        action={
          <Button href="/listing/new" variant="accent" size="md">
            {t("wizard.ctaLong")}
          </Button>
        }
      />
    );
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("account.filterAll") },
    { id: "active", label: t("account.filterActive") },
    { id: "done", label: t("account.filterDone") },
  ];
  const shown = bookings.filter((booking) => matchesFilter(booking.status, filter));

  return (
    <div>
      <div role="group" aria-label={t("account.filters")} className="mb-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
              filter === item.id
                ? "border-primary bg-primary text-surface"
                : "border-border bg-surface text-ink hover:border-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-card bg-surface p-6 text-center text-[15px] text-muted shadow-card">
          {t("account.filteredEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((booking) => {
            const photo = mediaUrl(booking.listing.photo);
            return (
              <li key={booking.id}>
                <Link
                  href={`/booking/${booking.id}`}
                  className="flex gap-3 rounded-card bg-surface p-3 shadow-card transition-colors hover:ring-1 hover:ring-primary"
                >
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-[12px] bg-deposit-bg">
                    {photo && <Image src={photo} alt="" fill sizes="80px" className="object-cover" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold text-ink">{booking.listing.title}</span>
                    <span className="text-[13px] text-muted">
                      {t("profile.bookingDates", {
                        from: formatShortDate(booking.start_date),
                        to: formatShortDate(booking.end_date),
                      })}
                    </span>
                    {role === "owner" && (
                      <span className="truncate text-[13px] text-muted">
                        {t("account.renterLabel", { name: booking.renter.name || t("listing.anonymousOwner") })}
                      </span>
                    )}
                    <span className="text-[13px] font-semibold text-accent-text">
                      {t("profile.bookingTotal", { amount: formatMoney(booking.total_price) })}
                    </span>
                  </span>
                  <StatusBadge status={booking.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
