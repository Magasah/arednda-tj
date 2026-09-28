import { forwardRef, useId } from "react";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Показать счётчик «N из max» (нужен maxLength) */
  count?: number;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, count, id, className, containerClassName, maxLength, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const counterId = count !== undefined && maxLength ? `${fieldId}-count` : undefined;
  const describedBy = [errorId, hintId, counterId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-32 w-full rounded-[12px] border bg-surface px-4 py-3 text-base text-ink",
          "placeholder:text-muted transition-colors focus-visible:border-primary",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
      <div className="mt-1.5 flex justify-between gap-3 text-[13px]">
        <span>
          {error ? (
            <span id={errorId} role="alert" className="text-sm text-danger">
              {error}
            </span>
          ) : (
            hint && (
              <span id={hintId} className="text-muted-bg">
                {hint}
              </span>
            )
          )}
        </span>
        {counterId && (
          <span id={counterId} className="shrink-0 tabular-nums text-muted-bg">
            {t("wizard.counter", { count: count ?? 0, max: maxLength ?? 0 })}
          </span>
        )}
      </div>
    </div>
  );
});
