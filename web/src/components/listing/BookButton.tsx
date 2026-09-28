"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";

// Окно бронирования с календарём — отдельный чанк, грузится по клику
const BookingModal = dynamic(() => import("@/components/booking/BookingModal").then((mod) => mod.BookingModal), {
  ssr: false,
});

interface BookButtonProps {
  listingId: string;
  ownerId: string;
  title: string;
  pricePerDay: string;
  deposit: string;
  disabled?: boolean;
  className?: string;
}

/** Гость → вход с возвратом к объявлению; владелец — своё не бронирует; остальные → календарь */
export function BookButton({ listingId, ownerId, title, pricePerDay, deposit, disabled = false, className }: BookButtonProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Пока сессия восстанавливается, клик увёл бы вошедшего на /login — ждём ответа
  const settling = useAuthStore((state) => state.status === "idle" || state.status === "loading");
  const userId = useAuthStore((state) => state.user?.id);
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const own = Boolean(userId) && userId === ownerId;

  if (own) {
    return (
      <Button href={`/listing/${listingId}/edit`} variant="outline" size="md" className={className ?? "w-full"}>
        {t("account.edit")}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="accent"
        size="md"
        className={className ?? "w-full"}
        disabled={disabled}
        loading={settling && !disabled}
        onClick={() => {
          if (!isAuthenticated) {
            router.push(`/login?next=${encodeURIComponent(pathname)}`);
            return;
          }
          setOpen(true);
        }}
      >
        {t("listing.book")}
      </Button>
      {open && (
        <BookingModal
          open={open}
          onOpenChange={setOpen}
          listingId={listingId}
          title={title}
          pricePerDay={pricePerDay}
          deposit={deposit}
        />
      )}
    </>
  );
}
