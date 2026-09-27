"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";

// Модалка (Radix Dialog) нужна только после клика — отдельный чанк
const ComingSoonModal = dynamic(() => import("./ComingSoonModal").then((mod) => mod.ComingSoonModal), {
  ssr: false,
});

/** Гость → на вход с возвратом к объявлению; вошедший → «скоро откроем» */
export function BookButton({ disabled = false, className }: { disabled?: boolean; className?: string }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="accent"
        size="md"
        className={className ?? "w-full"}
        disabled={disabled}
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
      {open && <ComingSoonModal open={open} onOpenChange={setOpen} />}
    </>
  );
}
