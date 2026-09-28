"use client";

import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { confirmPayment } from "@/lib/api/bookings";
import { errorMessage } from "@/lib/api/errors";
import type { PaymentMethod } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { messagesOf, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface PaymentModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  bookingId: string;
  amount: number;
  onPaid(): void;
}

const METHODS: { id: PaymentMethod; icon: typeof CreditCard }[] = [
  { id: "alif", icon: Smartphone },
  { id: "humo", icon: CreditCard },
  { id: "cash", icon: Banknote },
];

/** Выбор способа оплаты → confirm-payment (пока имитация: деньги «замораживаются» на эскроу) */
export function PaymentModal({ open, onOpenChange, bookingId, amount, onPaid }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("alif");
  const [sending, setSending] = useState(false);
  const names = messagesOf().deal.methods;
  const hints = messagesOf().deal.methodHints;

  async function pay() {
    setSending(true);
    try {
      await confirmPayment(bookingId, method);
      toast.success(t("deal.paid"));
      onPaid();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("deal.payTitle")}
      description={t("deal.payText")}
      footer={
        <>
          <Button variant="outline" size="md" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" size="md" loading={sending} onClick={() => void pay()}>
            {t("deal.pay", { amount: formatMoney(amount) })}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void pay();
        }}
      >
        <fieldset>
          <legend className="sr-only">{t("deal.payTitle")}</legend>
          <div className="flex flex-col gap-3">
            {METHODS.map(({ id, icon: MethodIcon }) => (
              <label
                key={id}
                className={cn(
                  "flex min-h-16 cursor-pointer items-center gap-4 rounded-[12px] border-2 p-4 transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                  method === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={id}
                  checked={method === id}
                  onChange={() => setMethod(id)}
                  className="size-5 accent-[#1A5276]"
                />
                <MethodIcon className="size-6 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block font-semibold text-ink">{names[id]}</span>
                  <span className="block text-[13px] text-muted">{hints[id]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
