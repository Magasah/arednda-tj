"use client";

import { MapPin, Pencil } from "lucide-react";
import Image from "next/image";
import { useFormContext } from "react-hook-form";

import { categoryIcon } from "@/components/listing/categoryIcon";
import { KiroyaIcon } from "@/components/ui/KiroyaIcon";
import type { Category } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { messagesOf, t } from "@/lib/i18n";

import { photoSrc, type PhotoItem } from "../photos";
import { toNumber, type ListingFormValues } from "../schema";

interface PreviewStepProps {
  categories: Category[];
  photos: PhotoItem[];
  onEdit(step: number): void;
}

function EditLink({ step, label, onEdit }: { step: number; label: string; onEdit(step: number): void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(step)}
      aria-label={`${t("wizard.previewEdit")}: ${label}`}
      className="inline-flex min-h-11 items-center gap-1 rounded-[8px] px-2 text-sm font-semibold text-primary hover:bg-primary/5"
    >
      <Pencil className="size-4" aria-hidden />
      {t("wizard.previewEdit")}
    </button>
  );
}

export function PreviewStep({ categories, photos, onEdit }: PreviewStepProps) {
  const { getValues } = useFormContext<ListingFormValues>();
  const values = getValues();
  const names = messagesOf().wizard.stepNames;
  const category = categories.find((item) => item.slug === values.category_slug);
  const cover = photos[0] ? photoSrc(photos[0]) : null;
  const deposit = toNumber(values.deposit_amount || "0");

  return (
    <div>
      <h2 className="text-xl font-bold text-ink">{t("wizard.previewTitle")}</h2>
      <article className="mt-5 overflow-hidden rounded-card bg-surface shadow-card">
        <div className="relative aspect-[4/3] w-full bg-deposit-bg sm:aspect-[16/9]">
          {cover && (
            <Image
              src={cover}
              alt={values.title}
              fill
              sizes="(min-width: 768px) 672px, 100vw"
              unoptimized={photos[0]?.kind === "new"}
              className="object-cover"
            />
          )}
          <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold text-surface">
            {t("wizard.photosCount", { count: photos.length })}
          </span>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              {category && (
                <p className="mb-1 flex items-center gap-2 text-sm font-medium text-muted">
                  <KiroyaIcon name={categoryIcon(category.slug, category.icon)} size={18} className="text-accent-text" />
                  {category.name_ru}
                </p>
              )}
              <h3 className="text-xl font-bold leading-snug text-ink">{values.title}</h3>
            </div>
            <EditLink step={1} label={names[1]} onEdit={onEdit} />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-accent-text">
                {t("common.perDay", { price: formatMoney(toNumber(values.price_per_day || "0")) })}
              </p>
              <p className="mt-1 w-fit rounded-[8px] bg-deposit-bg px-2 py-0.5 text-sm font-medium text-accent-text">
                {deposit > 0 ? t("common.deposit", { amount: formatMoney(deposit) }) : t("common.depositNone")}
              </p>
            </div>
            <EditLink step={2} label={names[2]} onEdit={onEdit} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[15px] text-ink">
              <MapPin className="size-4 text-accent-text" aria-hidden />
              {values.city}
              {values.lat != null && values.lng != null && (
                <span className="text-sm text-muted">
                  · {values.lat.toFixed(3)}, {values.lng.toFixed(3)}
                </span>
              )}
            </p>
            <EditLink step={3} label={names[3]} onEdit={onEdit} />
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">{t("listing.description")}</p>
            <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-muted">
              {values.description.trim() || t("listing.noDescription")}
            </p>
          </div>

          <div className="flex justify-end">
            <EditLink step={4} label={names[4]} onEdit={onEdit} />
          </div>
        </div>
      </article>
    </div>
  );
}
