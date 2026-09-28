"use client";

import { Star } from "lucide-react";
import { useState } from "react";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange(value: number): void;
  labelledBy?: string;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Выбор оценки 1–5: наведение подсвечивает звёзды, стрелки ←/→ меняют оценку.
 * Семантика — radiogroup: скринридер читает «4 из 5, выбрано»
 */
export function StarRating({ value, onChange, labelledBy, invalid, describedBy }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="flex gap-1"
      onMouseLeave={() => setHover(0)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          onChange(Math.min(5, (value || 0) + 1));
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          onChange(Math.max(1, (value || 2) - 1));
        }
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const checked = value === star;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t("reviews.star", { count: star })}
            // Фокус — на выбранной звезде (или первой), остальные — стрелками
            tabIndex={checked || (!value && star === 1) ? 0 : -1}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(0)}
            onClick={() => onChange(star)}
            className="flex size-11 items-center justify-center rounded-full transition-transform hover:scale-110"
          >
            <Star
              aria-hidden
              className={cn("size-8", star <= shown ? "fill-accent-btn text-accent-btn" : "fill-transparent text-muted")}
              strokeWidth={1.75}
            />
          </button>
        );
      })}
    </div>
  );
}
