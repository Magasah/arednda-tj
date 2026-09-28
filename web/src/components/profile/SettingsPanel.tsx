"use client";

import { BadgeCheck, Camera, Check, IdCard, Pencil, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { errorMessage } from "@/lib/api/errors";
import type { MeResponse } from "@/lib/api/types";
import { updateMyProfile, verifyPassport } from "@/lib/api/users";
import { checkImageFile, IMAGE_ACCEPT } from "@/lib/files";
import { formatPhoneInput } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

import { LogoutButton } from "./LogoutButton";

const AvatarCropModal = dynamic(() => import("./AvatarCropModal"), { ssr: false });

interface SettingsPanelProps {
  profile: MeResponse;
  onUpdated(profile: MeResponse): void;
}

const sectionClasses = "rounded-card bg-surface p-5 shadow-card";

// --- Имя: просмотр ↔ редактирование на месте ------------------------------------------------

function NameField({ profile, onUpdated }: SettingsPanelProps) {
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [editing, setEditing] = useState(false);
  const [shownName, setShownName] = useState(profile.user.name ?? "");
  const [draft, setDraft] = useState(shownName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function cancel() {
    setDraft(shownName);
    setError(null);
    setEditing(false);
    requestAnimationFrame(() => editRef.current?.focus());
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (value.length > 100) {
      setError(t("profile.nameTooLong"));
      return;
    }
    const previous = shownName;
    // Оптимистично: новое имя видно сразу, при ошибке — вернём старое
    setShownName(value);
    setEditing(false);
    setSaving(true);
    try {
      const updated = await updateMyProfile({ name: value });
      onUpdated(updated);
      await refreshUser().catch(() => undefined);
      toast.success(t("profile.nameSaved"));
    } catch (err) {
      setShownName(previous);
      setDraft(value);
      setError(errorMessage(err));
      setEditing(true);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t("profile.nameLabel")}</p>
          <p className={cn("mt-1 truncate text-lg", shownName ? "text-ink" : "text-muted")} aria-busy={saving}>
            {shownName || t("profile.noName")}
          </p>
        </div>
        <Button ref={editRef} variant="ghost" size="md" onClick={() => setEditing(true)} ariaLabel={t("account.editName")}>
          <Pencil className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("account.editName")}</span>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      noValidate
    >
      <Input
        ref={inputRef}
        label={t("profile.nameLabel")}
        placeholder={t("profile.namePlaceholder")}
        value={draft}
        maxLength={100}
        autoComplete="name"
        error={error}
        onChange={(event) => {
          setDraft(event.target.value);
          if (error) setError(null);
        }}
      />
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          <Check className="size-4" aria-hidden />
          {t("common.save")}
        </Button>
        <Button variant="ghost" size="sm" onClick={cancel}>
          <X className="size-4" aria-hidden />
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

// --- Аватар: выбор → кадрирование → загрузка ------------------------------------------------

function AvatarField({ profile, onUpdated }: SettingsPanelProps) {
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const hintId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function onPick(file: File) {
    if (await checkImageFile(file)) {
      setError(t("profile.avatarInvalid"));
      return;
    }
    setError(null);
    setSource(URL.createObjectURL(file));
  }

  function closeCrop() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
  }

  async function upload(file: File) {
    closeCrop();
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const updated = await updateMyProfile({ avatar: file });
      onUpdated(updated);
      await refreshUser().catch(() => undefined);
      toast.success(t("profile.avatarSaved"));
    } catch (err) {
      setPreview(null);
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <section aria-labelledby={`${hintId}-title`} className={sectionClasses}>
      <h2 id={`${hintId}-title`} className="text-base font-semibold text-ink">
        {t("profile.avatarLabel")}
      </h2>
      <div className="mt-4 flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- локальное превью (blob:) до ответа сервера
          <img src={preview} alt="" width={72} height={72} className="size-[72px] rounded-full object-cover" />
        ) : (
          <Avatar src={profile.user.avatar_url} name={profile.user.name} size={72} />
        )}
        <div>
          <Button
            variant="outline"
            size="md"
            loading={uploading}
            onClick={() => fileInput.current?.click()}
            aria-describedby={hintId}
          >
            <Camera className="size-5" aria-hidden />
            {t("profile.avatarUpload")}
          </Button>
          <p id={hintId} className="mt-2 text-[13px] text-muted">
            {t("profile.avatarHint")}
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void onPick(file);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {source && <AvatarCropModal src={source} onCancel={closeCrop} onApply={(file) => void upload(file)} />}
    </section>
  );
}

// --- Паспорт --------------------------------------------------------------------------------

function PassportField({ profile, onUpdated }: SettingsPanelProps) {
  const titleId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verified = profile.user.is_verified || Boolean(profile.passport_verified_at);

  async function onPick(file: File) {
    if (await checkImageFile(file)) {
      setError(t("profile.avatarInvalid"));
      return;
    }
    setError(null);
    setSending(true);
    try {
      onUpdated(await verifyPassport(file));
      toast.success(t("account.passportSent"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby={titleId} className={sectionClasses}>
      <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-ink">
        <IdCard className="size-5 text-primary" aria-hidden />
        {t("account.passportTitle")}
      </h2>
      {verified ? (
        <p className="mt-3 flex items-center gap-2 font-semibold text-success">
          <BadgeCheck className="size-5" aria-hidden />
          {t("account.passportDone")}
        </p>
      ) : (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{t("account.passportText")}</p>
          <Button variant="primary" size="md" className="mt-4" loading={sending} onClick={() => fileInput.current?.click()}>
            {t("account.passportUpload")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onPick(file);
            }}
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// --- Уведомления (заглушка: сохраняются только в браузере) -----------------------------------

const NOTIFY_KEY = "kiroya:notify";
type NotifyKey = "bookings" | "returns" | "reviews";

function readNotify(): Record<NotifyKey, boolean> {
  const defaults = { bookings: true, returns: true, reviews: true };
  try {
    return { ...defaults, ...(JSON.parse(window.localStorage.getItem(NOTIFY_KEY) ?? "{}") as object) };
  } catch {
    return defaults;
  }
}

function NotificationsField() {
  const titleId = useId();
  const [state, setState] = useState<Record<NotifyKey, boolean>>({ bookings: true, returns: true, reviews: true });

  useEffect(() => setState(readNotify()), []);

  function toggle(key: NotifyKey) {
    setState((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
      } catch {
        // хранилище недоступно — переключатель работает до перезагрузки
      }
      return next;
    });
  }

  const rows: { key: NotifyKey; label: string }[] = [
    { key: "bookings", label: t("account.notifyBookings") },
    { key: "returns", label: t("account.notifyReturns") },
    { key: "reviews", label: t("account.notifyReviews") },
  ];

  return (
    <section aria-labelledby={titleId} className={sectionClasses}>
      <h2 id={titleId} className="text-base font-semibold text-ink">
        {t("account.notifications")}
      </h2>
      <p className="mt-1 text-[13px] text-muted">{t("account.notifySoon")}</p>
      <ul className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key} className="flex min-h-12 items-center justify-between gap-4 py-1">
            <span id={`${titleId}-${row.key}`} className="text-[15px] text-ink">
              {row.label}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={state[row.key]}
              aria-labelledby={`${titleId}-${row.key}`}
              onClick={() => toggle(row.key)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full p-0 transition-colors",
                state[row.key] ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-1 top-1 size-5 rounded-full bg-surface shadow transition-transform",
                  state[row.key] ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SettingsPanel({ profile, onUpdated }: SettingsPanelProps) {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <AvatarField profile={profile} onUpdated={onUpdated} />
      <section className={sectionClasses}>
        <NameField profile={profile} onUpdated={onUpdated} />
      </section>
      <dl className={sectionClasses}>
        <dt className="text-sm font-semibold text-ink">{t("profile.phone")}</dt>
        <dd className="mt-1 text-base text-muted">{formatPhoneInput(profile.phone)}</dd>
      </dl>
      <PassportField profile={profile} onUpdated={onUpdated} />
      <NotificationsField />
      <LogoutButton className="w-full sm:w-auto sm:self-start" />
    </div>
  );
}
