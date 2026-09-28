"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** lg — для календаря и сравнения фото */
  size?: "md" | "lg";
}

/**
 * Доступная модалка (Radix Dialog: фокус-ловушка, Esc, aria-modal).
 * На мобиле — bottom sheet снизу, с sm — окно по центру.
 */
export function Modal({ open, onOpenChange, title, description, children, footer, size = "md" }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-surface p-6 shadow-card focus-visible:outline-none",
            // bottom sheet
            "inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[20px] pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "data-[state=open]:animate-[sheet-up_200ms_ease-out]",
            // центр
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-[calc(100%-2rem)]",
            size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-6",
            "sm:data-[state=open]:animate-[fade-in_200ms_ease-out]",
          )}
        >
          <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-xl font-bold text-ink">{title}</Dialog.Title>
            <Dialog.Close
              aria-label={t("common.close")}
              className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-background hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="mt-2 text-[15px] leading-relaxed text-muted">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalClose = Dialog.Close;
