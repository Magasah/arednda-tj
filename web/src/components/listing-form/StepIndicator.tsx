import { Check } from "lucide-react";

import { messagesOf, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  step: number;
  total: number;
  /** Переход на уже пройденный шаг */
  onSelect?(step: number): void;
}

/** 6 точек: текущая — оранжевая, пройденные — синие с галочкой, впереди — серые */
export function StepIndicator({ step, total, onSelect }: StepIndicatorProps) {
  const names = messagesOf().wizard.stepNames;

  return (
    <nav aria-label={t("wizard.progressLabel")}>
      <p className="mb-3 text-sm font-semibold text-muted-bg" aria-live="polite">
        {t("wizard.progress", { step: step + 1, total, name: names[step] })}
      </p>
      <ol className="flex items-center">
        {Array.from({ length: total }, (_, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li key={index} className={cn("flex items-center", index < total - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!done || !onSelect}
                onClick={() => onSelect?.(index)}
                aria-current={current ? "step" : undefined}
                aria-label={`${index + 1}. ${names[index]}`}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                  "disabled:cursor-default",
                  current && "bg-accent-btn text-surface ring-4 ring-accent/25",
                  done && "bg-primary text-surface hover:bg-primary/90",
                  !current && !done && "border-2 border-border bg-surface text-muted",
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : index + 1}
              </button>
              {index < total - 1 && (
                <span
                  aria-hidden
                  className={cn("mx-1 h-0.5 flex-1 rounded-full", index < step ? "bg-primary" : "bg-border")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
