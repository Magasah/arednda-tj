import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Скрыть подпись визуально (остаётся для скринридеров) */
  hideLabel?: boolean;
  hint?: string;
  error?: string | null;
  leading?: React.ReactNode;
  containerClassName?: string;
}

// font-size 16px — иначе iOS Safari зумит страницу при фокусе на поле
export const inputClasses = cn(
  "h-12 w-full rounded-[12px] border bg-surface px-4 text-base text-ink",
  "placeholder:text-muted transition-colors",
  "focus-visible:border-primary",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel = false, hint, error, leading, id, className, containerClassName, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label
        htmlFor={inputId}
        className={cn("mb-1.5 block text-sm font-semibold text-ink", hideLabel && "sr-only")}
      >
        {label}
      </label>
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            inputClasses,
            error ? "border-danger" : "border-border",
            leading && "pl-10",
            className,
          )}
          {...props}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[13px] text-muted-bg">
          {hint}
        </p>
      )}
    </div>
  );
});
