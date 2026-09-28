"use client";

import { Info } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

import { toNumber, type ListingFormValues } from "../schema";

export function PriceStep() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<ListingFormValues>();
  const price = toNumber(watch("price_per_day") ?? "");

  return (
    <div className="space-y-5">
      <Input
        label={t("wizard.priceLabel")}
        inputMode="decimal"
        placeholder="150"
        error={errors.price_per_day?.message}
        autoComplete="off"
        {...register("price_per_day")}
      />
      {Number.isFinite(price) && price >= 1 && (
        <p className="-mt-3 text-sm font-medium text-success" aria-live="polite">
          {t("wizard.earnHint", { amount: formatMoney(price * 7) })}
        </p>
      )}
      <Input
        label={t("wizard.depositLabel")}
        inputMode="decimal"
        placeholder="0"
        error={errors.deposit_amount?.message}
        autoComplete="off"
        {...register("deposit_amount")}
      />
      <p className="flex gap-3 rounded-[12px] bg-deposit-bg p-4 text-[14px] leading-relaxed text-ink">
        <Info className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden />
        {t("wizard.depositHint")}
      </p>
    </div>
  );
}
