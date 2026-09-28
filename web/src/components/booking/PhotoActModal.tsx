"use client";

import { Camera, RefreshCw, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { handover, returnItem } from "@/lib/api/bookings";
import { errorMessage } from "@/lib/api/errors";
import { compressImage } from "@/lib/compress";
import { checkImageFile, IMAGE_ACCEPT } from "@/lib/files";
import { formatMoney } from "@/lib/format";
import { messagesOf, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Shot {
  file: File;
  preview: string;
}

interface PhotoActModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  bookingId: string;
  kind: "handover" | "return";
  onDone(): void;
}

function Slot({
  label,
  shot,
  busy,
  onPick,
  onRemove,
}: {
  label: string;
  shot: Shot | null;
  busy: boolean;
  onPick(file: File): void;
  onRemove(): void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-[12px] border-2 border-dashed",
          shot ? "border-primary" : "border-accent/70 bg-deposit-bg",
        )}
      >
        {shot ? (
          <Image src={shot.preview} alt={label} fill unoptimized sizes="200px" className="object-cover" />
        ) : (
          <label
            htmlFor={id}
            className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 p-2 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
          >
            <Camera className={cn("size-8 text-accent-text", busy && "animate-pulse")} aria-hidden />
            <span className="text-[13px] font-semibold text-ink">
              {busy ? t("photoAct.compressing") : label}
            </span>
            <span className="sr-only">{t("photoAct.slotAdd", { slot: label })}</span>
          </label>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={IMAGE_ACCEPT}
          // Камера телефона сразу, основная (задняя)
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPick(file);
            event.target.value = "";
          }}
        />
        {shot && (
          <div className="absolute inset-x-1 top-1 flex justify-between">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={t("photoAct.slotReplace", { slot: label })}
              className="flex size-9 items-center justify-center rounded-full bg-surface/90 text-ink shadow"
            >
              <RefreshCw className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={t("photoAct.slotRemove", { slot: label })}
              className="flex size-9 items-center justify-center rounded-full bg-ink/70 text-surface"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
      <p className="text-center text-[13px] font-medium text-ink">{label}</p>
    </div>
  );
}

/** Фото-акт: 3 слота (общий вид, серийный номер, состояние), нужно хотя бы одно фото */
export function PhotoActModal({ open, onOpenChange, bookingId, kind, onDone }: PhotoActModalProps) {
  const slots = messagesOf().photoAct.slots;
  const [shots, setShots] = useState<(Shot | null)[]>(() => slots.map(() => null));
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(
    () => () => {
      for (const shot of shotsRef.current) if (shot) URL.revokeObjectURL(shot.preview);
    },
    [],
  );

  async function pick(index: number, file: File) {
    setError(null);
    const problem = await checkImageFile(file);
    if (problem) {
      setError(
        problem === "size"
          ? t("wizard.photoTooBig", { name: file.name })
          : problem === "type"
            ? t("wizard.photoBadType", { name: file.name })
            : t("wizard.photoFake", { name: file.name }),
      );
      return;
    }
    setBusySlot(index);
    const compressed = await compressImage(file);
    setBusySlot(null);
    setShots((current) => {
      const next = [...current];
      if (next[index]) URL.revokeObjectURL(next[index]!.preview);
      next[index] = { file: compressed, preview: URL.createObjectURL(compressed) };
      return next;
    });
  }

  function remove(index: number) {
    setShots((current) => {
      const next = [...current];
      if (next[index]) URL.revokeObjectURL(next[index]!.preview);
      next[index] = null;
      return next;
    });
  }

  async function submit() {
    const files = shots.flatMap((shot) => (shot ? [shot.file] : []));
    if (files.length === 0) {
      setError(t("photoAct.needPhoto"));
      return;
    }
    setSending(true);
    try {
      if (kind === "handover") {
        await handover(bookingId, files);
        toast.success(t("photoAct.handoverDone"));
      } else {
        const result = await returnItem(bookingId, files);
        toast.success(t("photoAct.returnDone"), {
          description:
            result.overdue_days > 0
              ? t("photoAct.penalty", { days: result.overdue_days, amount: formatMoney(result.penalty_amount) })
              : undefined,
        });
      }
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !sending && onOpenChange(next)}
      size="lg"
      title={kind === "handover" ? t("photoAct.handoverTitle") : t("photoAct.returnTitle")}
      description={t("photoAct.text")}
      footer={
        <>
          <Button variant="outline" size="md" disabled={sending} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" size="md" loading={sending} disabled={busySlot !== null} onClick={() => void submit()}>
            {sending
              ? t("photoAct.sending")
              : kind === "handover"
                ? t("photoAct.submitHandover")
                : t("photoAct.submitReturn")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        {slots.map((label, index) => (
          <Slot
            key={label}
            label={label}
            shot={shots[index]}
            busy={busySlot === index}
            onPick={(file) => void pick(index, file)}
            onRemove={() => remove(index)}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
}
