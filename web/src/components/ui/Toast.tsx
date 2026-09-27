"use client";

import { Toaster as SonnerToaster } from "sonner";

/** Уведомления (sonner). Вызов: import { toast } from "sonner"; toast.success("…") */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-[12px] !border-border !bg-surface !text-ink !shadow-card !font-sans",
          description: "!text-muted",
          error: "!text-danger",
          success: "!text-success",
        },
      }}
    />
  );
}
