"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const OTP_LENGTH = 6;

export interface OTPInputHandle {
  focus(index?: number): void;
}

interface OTPInputProps {
  value: string;
  onChange(value: string): void;
  /** Вызывается, когда введены все 6 цифр */
  onComplete?(code: string): void;
  invalid?: boolean;
  disabled?: boolean;
  /** id подписи группы (заголовок «Введите код из SMS») */
  labelledBy?: string;
  describedBy?: string;
}

/** 6 полей для кода: авто-переход вперёд, Backspace назад, вставка всего кода из буфера */
export const OTPInput = forwardRef<OTPInputHandle, OTPInputProps>(function OTPInput(
  { value, onChange, onComplete, invalid = false, disabled = false, labelledBy, describedBy },
  ref,
) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? "");

  const focus = (index: number) => {
    const target = inputs.current[Math.max(0, Math.min(index, OTP_LENGTH - 1))];
    target?.focus();
    target?.select();
  };

  useImperativeHandle(ref, () => ({ focus: (index = 0) => focus(index) }));

  const commit = (next: string[]) => {
    const code = next.join("").slice(0, OTP_LENGTH);
    onChange(code);
    if (code.length === OTP_LENGTH && !next.includes("")) onComplete?.(code);
  };

  /** Вставить несколько цифр начиная с позиции (вставка или автозаполнение SMS-кода) */
  const fill = (start: number, text: string) => {
    const incoming = text.replace(/\D/g, "").slice(0, OTP_LENGTH - start).split("");
    if (incoming.length === 0) return;
    const next = [...digits];
    incoming.forEach((digit, offset) => {
      next[start + offset] = digit;
    });
    commit(next);
    focus(Math.min(start + incoming.length, OTP_LENGTH - 1));
  };

  const onInput = (index: number, raw: string) => {
    const onlyDigits = raw.replace(/\D/g, "");
    if (onlyDigits.length > 1) {
      fill(index, onlyDigits);
      return;
    }
    const next = [...digits];
    next[index] = onlyDigits;
    commit(next);
    if (onlyDigits && index < OTP_LENGTH - 1) focus(index + 1);
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      commit(next);
      focus(index - 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focus(index + 1);
    }
  };

  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={index === 0 ? OTP_LENGTH : 1}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={t("auth.codeDigit", { index: index + 1 })}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={digit}
          onChange={(event) => onInput(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => {
            event.preventDefault();
            fill(index, event.clipboardData.getData("text"));
          }}
          onFocus={(event) => event.target.select()}
          className={cn(
            "h-14 w-full min-w-0 max-w-[52px] rounded-[12px] border-2 bg-surface text-center text-2xl font-bold text-ink",
            "transition-colors focus-visible:border-primary disabled:opacity-60",
            invalid ? "border-danger bg-danger/5 text-danger" : digit ? "border-primary/40" : "border-border",
          )}
        />
      ))}
    </div>
  );
});
