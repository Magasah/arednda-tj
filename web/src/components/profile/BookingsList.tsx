"use client";

import { CalendarRange } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import type { BookingDetail } from "@/lib/api/types";
import { getMyBookings } from "@/lib/api/users";
import { formatDate, formatMoney } from "@/lib/format";
import { messagesOf, t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES = new Set(["payment_frozen", "active", "return_pending"]);

export function BookingsList() {
  const [bookings, setBookings] = useState<BookingDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getMyBookings("renter")
      .then((items) => !cancelled && setBookings(items))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (error) {
    return (
      <EmptyState
        tone="error"
        title={t("errors.generic")}
        text={error}
        action={
          <Button variant="primary" size="md" onClick={() => setAttempt((value) => value + 1)}>
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
    return (
      <EmptyState
        icon={<CalendarRange className="size-7" />}
        title={t("profile.bookingsEmptyTitle")}
        text={t("profile.bookingsEmptyText")}
        action={
          <Button href="/catalog" variant="primary" size="md">
            {t("profile.goToCatalog")}
          </Button>
        }
      />
    );
  }

  const statuses = messagesOf().profile.bookingStatus;

  return (
    <ul className="flex flex-col gap-3">
      {bookings.map((booking) => {
        const photo = mediaUrl(booking.listing.photo);
        return (
          <li key={booking.id}>
            <Link
              href={`/listing/${booking.listing.id}`}
              className="flex gap-3 rounded-card bg-surface p-3 shadow-card transition-colors hover:ring-1 hover:ring-primary"
            >
              <span className="relative size-20 shrink-0 overflow-hidden rounded-[12px] bg-deposit-bg">
                {photo && <Image src={photo} alt="" fill sizes="80px" className="object-cover" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[15px] font-semibold text-ink">{booking.listing.title}</span>
                <span className="text-[13px] text-muted">
                  {t("profile.bookingDates", {
                    from: formatDate(booking.start_date, { day: "numeric", month: "short" }),
                    to: formatDate(booking.end_date, { day: "numeric", month: "short" }),
                  })}
                </span>
                <span className="text-[13px] font-semibold text-accent">
                  {t("profile.bookingTotal", { amount: formatMoney(booking.total_price) })}
                </span>
              </span>
              <span
                className={cn(
                  "h-fit shrink-0 rounded-[8px] px-2 py-1 text-xs font-semibold",
                  ACTIVE_STATUSES.has(booking.status) ? "bg-success/10 text-success" : "bg-background text-ink",
                )}
              >
                {statuses[booking.status]}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
