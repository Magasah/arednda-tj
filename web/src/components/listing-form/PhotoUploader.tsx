"use client";

import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import { checkImageFile, IMAGE_ACCEPT } from "@/lib/files";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { MAX_PHOTOS, move, nextPhotoId, photoSrc, revokePreviews, type PhotoItem } from "./photos";

interface PhotoUploaderProps {
  items: PhotoItem[];
  onChange(items: PhotoItem[]): void;
  /** Ошибка формы (например, «добавьте хотя бы одно фото») */
  error?: string | null;
  disabled?: boolean;
}

export function PhotoUploader({ items, onChange, error, disabled = false }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const found: string[] = [];
    const accepted: PhotoItem[] = [];
    for (const file of list) {
      if (items.length + accepted.length >= MAX_PHOTOS) {
        found.push(t("wizard.photosMax"));
        break;
      }
      const problem = await checkImageFile(file);
      if (problem === "type") found.push(t("wizard.photoBadType", { name: file.name }));
      else if (problem === "size") found.push(t("wizard.photoTooBig", { name: file.name }));
      else if (problem === "signature") found.push(t("wizard.photoFake", { name: file.name }));
      else accepted.push({ id: nextPhotoId(), kind: "new", file, preview: URL.createObjectURL(file) });
    }
    setProblems(found);
    if (accepted.length) onChange([...items, ...accepted]);
  }

  function remove(index: number) {
    revokePreviews([items[index]]);
    onChange(items.filter((_, i) => i !== index));
  }

  const full = items.length >= MAX_PHOTOS;
  const shownError = error ?? null;

  return (
    <div>
      <div
        onDragOver={(event) => {
          if (disabled || full || dragIndex !== null) return;
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          if (dragIndex !== null) return;
          event.preventDefault();
          setDragOver(false);
          if (!disabled && event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver ? "border-accent bg-deposit-bg" : "border-border bg-surface",
          shownError && "border-danger",
          (disabled || full) && "opacity-60",
        )}
      >
        <ImagePlus className="mb-3 size-10 text-accent" aria-hidden />
        <p className="text-[15px] text-ink">
          {t("wizard.photosDrop")}{" "}
          <label
            htmlFor={inputId}
            className={cn(
              "cursor-pointer font-semibold text-primary underline underline-offset-2",
              (disabled || full) && "pointer-events-none",
            )}
          >
            {t("wizard.photosPick")}
          </label>
        </p>
        <p className="mt-1 text-[13px] text-muted">{t("wizard.photosHint")}</p>
        <p className="mt-2 text-sm font-semibold text-ink" aria-live="polite">
          {t("wizard.photosCount", { count: items.length })}
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          disabled={disabled || full}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? errorId : undefined}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {(shownError || problems.length > 0) && (
        <div id={errorId} role="alert" className="mt-2 space-y-1 text-sm text-danger">
          {shownError && <p>{shownError}</p>}
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item, index) => {
            const src = photoSrc(item);
            const number = index + 1;
            return (
              <li
                key={item.id}
                draggable={!disabled}
                onDragStart={(event) => {
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (dragIndex === null) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (dragIndex === null) return;
                  event.preventDefault();
                  onChange(move(items, dragIndex, index));
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-[12px] bg-deposit-bg shadow-card",
                  index === 0 && "ring-2 ring-accent",
                  dragIndex === index && "opacity-50",
                )}
              >
                {src && (
                  <Image
                    src={src}
                    alt={t("wizard.photoAlt", { index: number, total: items.length })}
                    fill
                    sizes="(min-width: 640px) 160px, 45vw"
                    unoptimized={item.kind === "new"}
                    className="object-cover"
                  />
                )}
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-accent-btn px-2 py-0.5 text-xs font-semibold text-surface">
                    {t("wizard.photoMain")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  aria-label={t("wizard.photoRemove", { index: number })}
                  className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-ink/70 text-surface hover:bg-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <button
                    type="button"
                    onClick={() => onChange(move(items, index, index - 1))}
                    disabled={disabled || index === 0}
                    aria-label={t("wizard.photoLeft", { index: number })}
                    className="flex size-9 items-center justify-center rounded-full bg-surface/90 text-ink shadow disabled:invisible"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange(move(items, index, 0))}
                      disabled={disabled}
                      aria-label={`${t("wizard.photoMakeMain")}: ${number}`}
                      title={t("wizard.photoMakeMain")}
                      className="flex size-9 items-center justify-center rounded-full bg-surface/90 text-accent-text shadow"
                    >
                      <Star className="size-4" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(move(items, index, index + 1))}
                    disabled={disabled || index === items.length - 1}
                    aria-label={t("wizard.photoRight", { index: number })}
                    className="flex size-9 items-center justify-center rounded-full bg-surface/90 text-ink shadow disabled:invisible"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
