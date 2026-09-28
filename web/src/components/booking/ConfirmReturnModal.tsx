"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { confirmReturn } from "@/lib/api/bookings";
import { errorMessage } from "@/lib/api/errors";
import type { Handover } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface ConfirmReturnModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  bookingId: string;
  handover: Handover | null;
  onDone(): void;
}

function PhotoColumn({ title, photos }: { title: string; photos: string[] }) {
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-semibold text-ink">{title}</figcaption>
      {photos.length ? (
        <ul className="grid gap-2">
          {photos.map((photo, index) => {
            const src = mediaUrl(photo);
            return (
              <li key={photo} className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-deposit-bg">
                {src && (
                  <Image src={src} alt={`${title}: ${index + 1}`} fill sizes="(min-width: 640px) 300px, 45vw" className="object-cover" />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-[12px] bg-background p-4 text-sm text-muted-bg">{t("confirmReturn.noPhoto")}</p>
      )}
    </figure>
  );
}

/** Владелец сравнивает фото «до» и «после» и подтверждает состояние вещи */
export function ConfirmReturnModal({ open, onOpenChange, bookingId, handover, onDone }: ConfirmReturnModalProps) {
  const name = useId();
  const [condition, setCondition] = useState<"good" | "damaged">("good");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (condition === "damaged" && !description.trim()) {
      setError(t("confirmReturn.describeRequired"));
      return;
    }
    setSending(true);
    try {
      const result = await confirmReturn(bookingId, condition, description.trim());
      toast.success(result.status === "disputed" ? t("confirmReturn.disputeOpened") : t("confirmReturn.done"));
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const options = [
    { id: "good" as const, label: t("confirmReturn.good"), hint: t("confirmReturn.goodHint") },
    { id: "damaged" as const, label: t("confirmReturn.damaged"), hint: t("confirmReturn.damagedHint") },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !sending && onOpenChange(next)}
      size="lg"
      title={t("confirmReturn.title")}
      description={t("confirmReturn.text")}
      footer={
        <>
          <Button variant="outline" size="md" disabled={sending} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={condition === "damaged" ? "danger" : "accent"}
            size="md"
            loading={sending}
            onClick={() => void submit()}
          >
            {t("confirmReturn.submit")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <PhotoColumn title={t("confirmReturn.before")} photos={handover?.photos_before ?? []} />
        <PhotoColumn title={t("confirmReturn.after")} photos={handover?.photos_after ?? []} />
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">{t("confirmReturn.condition")}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-[12px] border-2 p-4 transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                condition === option.id
                  ? option.id === "good"
                    ? "border-success bg-success/5"
                    : "border-danger bg-danger/5"
                  : "border-border",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={condition === option.id}
                onChange={() => {
                  setCondition(option.id);
                  setError(null);
                }}
                className="mt-0.5 size-5 accent-[#1A5276]"
              />
              <span>
                <span className="block font-semibold text-ink">{option.label}</span>
                <span className="block text-[13px] text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {condition === "damaged" && (
        <Textarea
          containerClassName="mt-4"
          label={t("confirmReturn.describe")}
          placeholder={t("confirmReturn.describePlaceholder")}
          value={description}
          maxLength={2000}
          count={description.length}
          error={error}
          onChange={(event) => {
            setDescription(event.target.value);
            if (error) setError(null);
          }}
        />
      )}
    </Modal>
  );
}
