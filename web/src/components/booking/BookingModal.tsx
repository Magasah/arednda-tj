"use client";

import { CalendarRange } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { createBooking } from "@/lib/api/bookings";
import { errorMessage } from "@/lib/api/errors";
import { getBusyDates } from "@/lib/api/listings";
import type { BusyPeriod } from "@/lib/api/types";
import { formatLongDate, parseDay } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { messagesOf, plural, t } from "@/lib/i18n";

import { busyMatchers, calcPrice, MAX_RENTAL_DAYS, overlapsBusy, toApiRange } from "./logic";

const DateRangePicker = dynamic(() => import("./DateRangePicker"), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto h-80 w-full max-w-sm rounded-card" />,
});

export interface BookingModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  listingId: string;
  title: string;
  pricePerDay: string;
  deposit: string;
}

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

export function BookingModal({ open, onOpenChange, listingId, title, pricePerDay, deposit }: BookingModalProps) {
  const router = useRouter();
  const wide = useWide();
  const [busy, setBusy] = useState<BusyPeriod[] | null>(null);
  const [range, setRange] = useState<DateRange | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getBusyDates(listingId)
      .then((periods) => !cancelled && setBusy(periods))
      .catch(() => !cancelled && setBusy([]));
    return () => {
      cancelled = true;
    };
  }, [open, listingId]);

  const matchers = useMemo(() => busyMatchers(busy ?? []), [busy]);
  const selection = range?.from ? toApiRange(range.from, range.to) : null;
  const price = selection ? calcPrice(pricePerDay, deposit, selection.days) : null;
  const words = messagesOf().booking.dayWords;

  function validate(): string | null {
    if (!selection) return t("booking.pickDates");
    if (selection.days > MAX_RENTAL_DAYS) return t("booking.maxDays");
    if (selection.end <= selection.start) return t("booking.endAfterStart");
    if (busy && overlapsBusy(selection.start, selection.end, busy)) return t("booking.busyInside");
    return null;
  }

  async function submit() {
    const problem = validate();
    setError(problem);
    if (problem || !selection) return;
    setSubmitting(true);
    try {
      const created = await createBooking(listingId, selection.start, selection.end);
      toast.success(t("booking.created"));
      router.push(`/booking/${created.booking.id}`);
    } catch (err) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
      // Даты могли занять, пока окно было открыто — обновим календарь
      getBusyDates(listingId).then(setBusy).catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t("booking.title")}
      description={title}
      footer={
        <>
          <Button variant="outline" size="md" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" size="md" loading={submitting} disabled={!selection} onClick={() => void submit()}>
            {submitting ? t("booking.submitting") : t("booking.submit")}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="flex items-start gap-2 text-[14px] leading-relaxed text-muted">
          <CalendarRange className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
          {t("booking.pickHint")}
        </p>

        <div className="mt-4 overflow-x-auto">
          {busy === null ? (
            <p role="status" className="py-24 text-center text-sm text-muted">
              {t("booking.busyLoading")}
            </p>
          ) : (
            <DateRangePicker
              value={range}
              onChange={(next) => {
                setRange(next);
                setError(null);
              }}
              busy={matchers}
              months={wide ? 2 : 1}
            />
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-[12px] bg-background p-4 text-[15px]">
          <div>
            <dt className="text-[13px] text-muted-bg">{t("booking.start")}</dt>
            <dd className="font-semibold text-ink">
              {selection ? formatLongDate(parseDay(selection.start)) : t("booking.notPicked")}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted-bg">{t("booking.end")}</dt>
            <dd className="font-semibold text-ink">
              {selection ? formatLongDate(parseDay(selection.end)) : t("booking.notPicked")}
            </dd>
          </div>
        </dl>

        {price && (
          <dl className="mt-4 space-y-2 text-[15px]" aria-live="polite">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">
                {t("booking.rent", {
                  price: formatMoney(pricePerDay),
                  days: t("booking.days", { count: price.days, word: plural(price.days, words) }),
                })}
              </dt>
              <dd className="font-semibold text-ink">
                {formatMoney(price.rent)} {t("common.somoni")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("booking.deposit")}</dt>
              <dd className="font-semibold text-ink">
                {formatMoney(price.deposit)} {t("common.somoni")}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-2 text-base">
              <dt className="font-bold text-ink">{t("booking.total")}</dt>
              <dd className="font-bold text-accent-text">
                {formatMoney(price.total)} {t("common.somoni")}
              </dd>
            </div>
          </dl>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
