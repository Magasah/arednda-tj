"use client";

import { Camera, CheckCircle2, Clock, CreditCard, MapPin, SearchX, Star, XCircle } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ReviewForm } from "@/components/reviews/ReviewForm";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { cancelBooking, getBooking } from "@/lib/api/bookings";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { BookingDetail, BookingStatus, Participant } from "@/lib/api/types";
import { formatDateTime, formatLongDate, formatRelative, parseDay } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { messagesOf, plural, t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { useAuthStore } from "@/lib/store/auth";

import { DealSteps } from "./DealSteps";
import { amountToPay, availableActions, type DealRole } from "./logic";
import { StatusBadge } from "./StatusBadge";

// Модалки действий — отдельные чанки: у каждого участника на каждом этапе нужна максимум одна
const PaymentModal = dynamic(() => import("./PaymentModal").then((mod) => mod.PaymentModal), { ssr: false });
const PhotoActModal = dynamic(() => import("./PhotoActModal").then((mod) => mod.PhotoActModal), { ssr: false });
const ConfirmReturnModal = dynamic(() => import("./ConfirmReturnModal").then((mod) => mod.ConfirmReturnModal), {
  ssr: false,
});

type OpenModal = "pay" | "cancel" | "handover" | "return" | "confirm-return" | null;

export function BookingSkeleton() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy="true">
      <span className="sr-only" role="status">
        {t("common.loading")}
      </span>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-6 h-28 w-full rounded-card" />
      <Skeleton className="mt-4 h-24 w-full rounded-card" />
      <Skeleton className="mt-4 h-48 w-full rounded-card" />
    </div>
  );
}

function PersonLink({ person, label }: { person: Participant; label: string }) {
  return (
    <Link
      href={`/user/${person.id}`}
      className="flex min-h-11 items-center gap-3 rounded-[12px] p-1 transition-colors hover:bg-primary/5"
    >
      <Avatar src={person.avatar_url} name={person.name} size={40} />
      <span className="min-w-0">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="block truncate font-semibold text-ink">{person.name || t("listing.anonymousOwner")}</span>
      </span>
    </Link>
  );
}

function PhotoStrip({ title, photos }: { title: string; photos: string[] }) {
  if (!photos.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo, index) => {
          const src = mediaUrl(photo);
          return (
            <li key={photo} className="relative size-24 shrink-0 overflow-hidden rounded-[12px] bg-deposit-bg">
              {src && <Image src={src} alt={`${title}: ${index + 1}`} fill sizes="96px" className="object-cover" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Статус после действия — показываем сразу (оптимистично), затем сверяем с сервером */
const AFTER: Partial<Record<Exclude<OpenModal, null>, BookingStatus>> = {
  pay: "payment_frozen",
  cancel: "cancelled",
  handover: "active",
  return: "return_pending",
};

interface BookingViewProps {
  id: string;
  /** Бронь, загруженная на сервере (SSR) */
  initial?: BookingDetail | null;
  /** Кто смотрит — известно серверу до восстановления сессии в браузере */
  viewerId?: string;
}

export function BookingView({ id, initial = null, viewerId }: BookingViewProps) {
  const userId = useAuthStore((state) => state.user?.id) ?? viewerId;
  const [booking, setBooking] = useState<BookingDetail | null>(initial);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [modal, setModal] = useState<OpenModal>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    getBooking(id)
      .then((data) => {
        setBooking(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError({
          message: errorMessage(err),
          notFound: isApiError(err) && (err.code === "not_found" || err.code === "forbidden" || err.code === "validation"),
        }),
      );
  }, [id]);

  const hasInitial = initial !== null;
  useEffect(() => {
    if (!hasInitial) load();
  }, [hasInitial, load]);

  const afterAction = useCallback(
    (action: Exclude<OpenModal, null>) => {
      const status = AFTER[action];
      if (status) setBooking((current) => (current ? { ...current, status } : current));
      load();
    },
    [load],
  );

  if (error) {
    return (
      <EmptyState
        tone={error.notFound ? "empty" : "error"}
        icon={<SearchX className="size-7" aria-hidden />}
        title={error.notFound ? t("deal.notFoundTitle") : t("errors.generic")}
        text={error.notFound ? t("deal.notFoundText") : error.message}
        action={
          error.notFound ? (
            <Button href="/profile?tab=bookings" variant="primary" size="md">
              {t("deal.toBookings")}
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={load}>
              {t("common.retry")}
            </Button>
          )
        }
      />
    );
  }

  if (!booking) return <BookingSkeleton />;

  const role: DealRole = booking.renter_id === userId ? "renter" : "owner";
  const other = role === "renter" ? booking.owner : booking.renter;
  const actions = availableActions(booking, role);
  const photo = mediaUrl(booking.listing.photo);
  const pay = amountToPay(booking);
  const dayWords = messagesOf().booking.dayWords;
  const starts = parseDay(booking.start_date);
  const upcoming = starts.getTime() > Date.now();

  const info = statusText(booking, role);

  async function onCancel() {
    setCancelling(true);
    try {
      await cancelBooking(booking!.id);
      toast.success(t("deal.cancelled"));
      setModal(null);
      afterAction("cancel");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t("deal.title")}</h1>
        <StatusBadge status={booking.status} className="text-sm" />
      </div>
      <p className="mt-1 text-sm text-muted-bg">{role === "renter" ? t("deal.youRenter") : t("deal.youOwner")}</p>

      {/* Вещь */}
      <Link
        href={`/listing/${booking.listing.id}`}
        className="mt-6 flex gap-4 rounded-card bg-surface p-4 shadow-card transition-colors hover:ring-1 hover:ring-primary"
      >
        <span className="relative size-20 shrink-0 overflow-hidden rounded-[12px] bg-deposit-bg sm:size-24">
          {photo && <Image src={photo} alt="" fill sizes="96px" className="object-cover" />}
        </span>
        <span className="flex min-w-0 flex-col justify-center gap-1">
          <span className="text-[13px] text-muted">{t("deal.item")}</span>
          <span className="line-clamp-2 text-lg font-semibold leading-snug text-ink">{booking.listing.title}</span>
          <span className="flex items-center gap-1 text-[13px] text-muted">
            <MapPin className="size-3.5" aria-hidden />
            {booking.listing.city}
          </span>
        </span>
      </Link>

      {/* Этапы */}
      {booking.status !== "cancelled" && (
        <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
          <h2 className="sr-only">{t("deal.steps")}</h2>
          <DealSteps status={booking.status} />
        </section>
      )}

      {/* Даты и суммы */}
      <section aria-labelledby="deal-sums" className="mt-4 rounded-card bg-surface p-5 shadow-card">
        <h2 id="deal-sums" className="sr-only">
          {t("deal.dates")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <dl>
            <dt className="text-[13px] text-muted">{t("deal.dates")}</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              {t("deal.period", { from: formatLongDate(booking.start_date), to: formatLongDate(booking.end_date) })}
            </dd>
            <dd className="text-[13px] text-muted">
              {t("booking.days", { count: booking.days, word: plural(booking.days, dayWords) })}
              {upcoming && ` · ${formatRelative(starts)}`}
            </dd>
          </dl>
          <dl className="space-y-1.5 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("deal.rent")}</dt>
              <dd className="font-semibold text-ink">
                {formatMoney(booking.total_price)} {t("common.somoni")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("deal.deposit")}</dt>
              <dd className="font-semibold text-ink">
                {formatMoney(booking.deposit_amount)} {t("common.somoni")}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-1.5">
              <dt className="font-bold text-ink">{t("deal.total")}</dt>
              <dd className="font-bold text-accent-text">
                {formatMoney(pay)} {t("common.somoni")}
              </dd>
            </div>
          </dl>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <PersonLink person={other} label={role === "renter" ? t("deal.owner") : t("deal.renter")} />
        </div>
      </section>

      {/* Что дальше */}
      <section aria-live="polite" className="mt-4 rounded-card bg-surface p-5 shadow-card">
        {info && (
          <p className="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
            <info.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            {info.text}
          </p>
        )}
        {booking.status === "pending" && booking.payment_expires_at && role === "renter" && (
          <p className="mt-2 text-sm font-medium text-accent-text">
            {t("deal.payUntil", { time: formatDateTime(booking.payment_expires_at) })}
          </p>
        )}

        {actions.some((action) => action !== "review") && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {actions.includes("pay") && (
              <Button variant="accent" size="md" onClick={() => setModal("pay")}>
                <CreditCard className="size-5" aria-hidden />
                {t("deal.pay", { amount: formatMoney(pay) })}
              </Button>
            )}
            {actions.includes("cancel") && (
              <Button variant="outline" size="md" onClick={() => setModal("cancel")}>
                {t("deal.cancel")}
              </Button>
            )}
            {actions.includes("handover") && (
              <Button variant="accent" size="md" onClick={() => setModal("handover")}>
                <Camera className="size-5" aria-hidden />
                {t("deal.handoverAction")}
              </Button>
            )}
            {actions.includes("return") && (
              <Button variant="accent" size="md" onClick={() => setModal("return")}>
                <Camera className="size-5" aria-hidden />
                {t("deal.returnAction")}
              </Button>
            )}
            {actions.includes("confirm-return") && (
              <Button variant="accent" size="md" onClick={() => setModal("confirm-return")}>
                <CheckCircle2 className="size-5" aria-hidden />
                {t("deal.confirmReturnAction")}
              </Button>
            )}
          </div>
        )}
      </section>

      {actions.includes("review") && (
        <div className="mt-4">
          <ReviewForm
            bookingId={booking.id}
            aboutName={other.name || t("listing.anonymousOwner")}
            onDone={() => {
              setBooking((current) => (current ? { ...current, reviewed_by_me: true } : current));
              load();
            }}
          />
        </div>
      )}
      {booking.status === "completed" && booking.reviewed_by_me && (
        <p className="mt-4 flex items-center gap-2 rounded-card bg-surface p-5 text-[15px] text-ink shadow-card">
          <Star className="size-5 fill-accent-btn text-accent-btn" aria-hidden />
          {t("deal.reviewed")}
        </p>
      )}

      {booking.handover && (
        <section className="mt-4 space-y-4 rounded-card bg-surface p-5 shadow-card">
          <PhotoStrip title={t("deal.photosBefore")} photos={booking.handover.photos_before} />
          <PhotoStrip title={t("deal.photosAfter")} photos={booking.handover.photos_after ?? []} />
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/profile?tab=bookings" variant="ghost" size="md">
          {t("deal.toBookings")}
        </Button>
      </div>

      {modal === "pay" && (
        <PaymentModal
          open
          onOpenChange={(open) => !open && setModal(null)}
          bookingId={booking.id}
          amount={pay}
          onPaid={() => afterAction("pay")}
        />
      )}
      {(modal === "handover" || modal === "return") && (
        <PhotoActModal
          open
          onOpenChange={(open) => !open && setModal(null)}
          bookingId={booking.id}
          kind={modal}
          onDone={() => afterAction(modal)}
        />
      )}
      {modal === "confirm-return" && (
        <ConfirmReturnModal
          open
          onOpenChange={(open) => !open && setModal(null)}
          bookingId={booking.id}
          handover={booking.handover}
          onDone={() => load()}
        />
      )}
      <Modal
        open={modal === "cancel"}
        onOpenChange={(open) => !open && setModal(null)}
        title={t("deal.cancelTitle")}
        description={t("deal.cancelText")}
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setModal(null)}>
              {t("common.back")}
            </Button>
            <Button variant="danger" size="md" loading={cancelling} onClick={() => void onCancel()}>
              {t("deal.cancelConfirm")}
            </Button>
          </>
        }
      />
    </div>
  );
}

/** Пояснение «что сейчас происходит» для роли */
function statusText(booking: BookingDetail, role: DealRole): { icon: typeof Clock; text: string } | null {
  switch (booking.status) {
    case "pending":
      return role === "owner" ? { icon: Clock, text: t("deal.ownerWaitPayment") } : null;
    case "payment_frozen":
      return role === "owner"
        ? { icon: CheckCircle2, text: t("deal.ownerWaitHandover") }
        : { icon: CheckCircle2, text: t("deal.paid") };
    case "active":
      return role === "owner"
        ? { icon: Clock, text: t("deal.ownerActive", { date: formatLongDate(booking.end_date) }) }
        : { icon: Clock, text: t("deal.renterWaitActive") };
    case "return_pending":
      return role === "renter" ? { icon: Clock, text: t("deal.renterReturnPending") } : null;
    case "completed":
      return { icon: CheckCircle2, text: t("deal.completedText") };
    case "cancelled":
      return { icon: XCircle, text: t("deal.cancelledText") };
    case "disputed":
      return { icon: XCircle, text: t("deal.disputedText") };
    case "resolved":
      return { icon: CheckCircle2, text: t("deal.resolvedText") };
    default:
      return null;
  }
}
