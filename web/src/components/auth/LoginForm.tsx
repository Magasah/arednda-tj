"use client";

import { ArrowLeft, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { sendOTP } from "@/lib/api/auth";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatPhoneInput, isValidTjPhone, maskPhone, toE164 } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";

import { lockRemaining, registerFailure, resetFailures, RESEND_SECONDS } from "./loginLock";
import { OTP_LENGTH, OTPInput, type OTPInputHandle } from "./OTPInput";
import { useCountdown } from "./useCountdown";

interface LoginFormProps {
  /** Куда вернуть после входа (уже проверенный внутренний путь) */
  nextPath: string;
}

type Step = "phone" | "code";

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const titleId = useId();
  const codeTitleId = useId();
  const codeErrorId = useId();
  const otpRef = useRef<OTPInputHandle>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+992 ");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [lockMs, setLockMs] = useState(0);
  const cooldown = useCountdown();

  // Блокировка после 5 неверных кодов переживает перезагрузку (localStorage)
  useEffect(() => {
    setLockMs(lockRemaining());
  }, []);

  useEffect(() => {
    if (lockMs <= 0) return;
    const timer = window.setInterval(() => setLockMs(lockRemaining()), 1000);
    return () => window.clearInterval(timer);
  }, [lockMs]);

  useEffect(() => {
    if (step === "code") otpRef.current?.focus(0);
  }, [step]);

  const locked = lockMs > 0;
  const lockMessage = t("auth.locked", { minutes: Math.max(1, Math.ceil(lockMs / 60000)) });

  /** Отправить SMS. Возвращает текст ошибки или null при успехе */
  async function requestCode(): Promise<string | null> {
    if (!isValidTjPhone(phone)) {
      const message = t("auth.phoneInvalid");
      setPhoneError(message);
      phoneRef.current?.focus();
      return message;
    }
    if (cooldown.active) return t("auth.rateLimited");
    if (sending) return null;

    setSending(true);
    setPhoneError(null);
    try {
      await sendOTP(toE164(phone));
      cooldown.start(RESEND_SECONDS);
      return null;
    } catch (error) {
      if (isApiError(error) && error.code === "rate_limited") {
        cooldown.start(RESEND_SECONDS);
        setPhoneError(t("auth.rateLimited"));
        return t("auth.rateLimited");
      }
      const message = errorMessage(error);
      setPhoneError(message);
      toast.error(t("toast.otpError"), { description: message });
      return message;
    } finally {
      setSending(false);
    }
  }

  async function onPhoneSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((await requestCode()) === null) {
      setCode("");
      setCodeError(null);
      setStep("code");
    }
  }

  async function onResend() {
    const error = await requestCode();
    if (error === null) {
      setCode("");
      setCodeError(null);
      toast.success(t("toast.otpSent"));
      otpRef.current?.focus(0);
    } else {
      setCodeError(error);
    }
  }

  async function verify(value: string) {
    if (value.length !== OTP_LENGTH || verifying) return;
    const remaining = lockRemaining();
    if (remaining > 0) {
      setLockMs(remaining);
      setCodeError(lockMessage);
      return;
    }

    setVerifying(true);
    setCodeError(null);
    try {
      await login(toE164(phone), value);
      resetFailures();
      toast.success(t("toast.loginSuccess"));
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setCode("");
      if (isApiError(error) && (error.code === "unauthorized" || error.code === "validation")) {
        const left = registerFailure();
        if (left === 0) {
          const lockFor = lockRemaining();
          setLockMs(lockFor);
          setCodeError(t("auth.locked", { minutes: Math.ceil(lockFor / 60000) }));
        } else {
          setCodeError(`${t("auth.codeInvalid")}. ${t("auth.attemptsLeft", { count: left })}`);
          otpRef.current?.focus(0);
        }
      } else if (isApiError(error) && error.code === "rate_limited") {
        setCodeError(t("auth.rateLimited"));
      } else if (isApiError(error) && error.code === "forbidden") {
        setCodeError(t("auth.blocked"));
      } else {
        const message = errorMessage(error);
        setCodeError(message);
        toast.error(message);
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="w-full rounded-card bg-surface p-6 shadow-card sm:p-8">
      {step === "phone" ? (
        <form onSubmit={onPhoneSubmit} noValidate aria-labelledby={titleId}>
          <h1 id={titleId} className="text-2xl font-bold text-primary">
            {t("auth.title")}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{t("auth.subtitle")}</p>

          <Input
            ref={phoneRef}
            containerClassName="mt-6"
            label={t("auth.phoneLabel")}
            hint={t("auth.phoneHint")}
            error={phoneError}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            name="phone"
            value={phone}
            maxLength={17}
            leading={<Phone className="size-5" aria-hidden />}
            onChange={(event) => {
              setPhone(formatPhoneInput(event.target.value));
              if (phoneError) setPhoneError(null);
            }}
            onFocus={(event) => {
              // Курсор — после «+992 », чтобы первая цифра не попала перед кодом страны
              const input = event.currentTarget;
              requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
            }}
          />

          <Button
            type="submit"
            variant="accent"
            size="md"
            className="mt-6 w-full"
            loading={sending}
            disabled={cooldown.active}
          >
            {sending
              ? t("auth.sending")
              : cooldown.active
                ? t("auth.getCodeIn", { seconds: cooldown.seconds })
                : t("auth.getCode")}
          </Button>

          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            {renderAgreement()}
          </p>
        </form>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCodeError(null);
            }}
            className="-ml-2 flex min-h-11 items-center gap-1 rounded-[8px] px-2 text-sm font-medium text-primary hover:bg-primary/5"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("auth.changePhone")}
          </button>

          <h1 id={codeTitleId} className="mt-2 text-2xl font-bold text-primary">
            {t("auth.codeTitle")}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {t("auth.codeSent", { phone: maskPhone(phone) })}
          </p>

          <form
            className="mt-6"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
          >
            <OTPInput
              ref={otpRef}
              value={code}
              onChange={(value) => {
                setCode(value);
                if (codeError && !locked) setCodeError(null);
              }}
              onComplete={(value) => void verify(value)}
              invalid={Boolean(codeError)}
              disabled={verifying || locked}
              labelledBy={codeTitleId}
              describedBy={codeError ? codeErrorId : undefined}
            />

            <p id={codeErrorId} role="alert" aria-live="assertive" className="mt-3 min-h-5 text-sm text-danger">
              {locked ? lockMessage : codeError}
            </p>

            <Button
              type="submit"
              variant="accent"
              size="md"
              className="mt-3 w-full"
              loading={verifying}
              disabled={code.length !== OTP_LENGTH || locked}
            >
              {verifying ? t("auth.verifying") : t("auth.submitCode")}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => void onResend()}
            disabled={cooldown.active || sending || locked}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-[8px] text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
          >
            {cooldown.active ? t("auth.resendIn", { seconds: cooldown.seconds }) : t("auth.resend")}
          </button>

          {process.env.NODE_ENV !== "production" && (
            <p className="mt-4 rounded-[8px] bg-background p-3 text-[13px] text-muted-bg">{t("auth.devHint")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function renderAgreement() {
  const [before, rest] = t("auth.agreement").split("{terms}");
  const [middle, after] = (rest ?? "").split("{privacy}");
  return (
    <>
      {before}
      <Link href="/terms" className="font-medium text-primary underline underline-offset-2">
        {t("auth.agreementTerms")}
      </Link>
      {middle}
      <Link href="/privacy" className="font-medium text-primary underline underline-offset-2">
        {t("auth.agreementPrivacy")}
      </Link>
      {after}
    </>
  );
}
