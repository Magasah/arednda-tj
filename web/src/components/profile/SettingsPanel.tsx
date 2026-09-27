"use client";

import { Camera } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { errorMessage } from "@/lib/api/errors";
import type { MeResponse } from "@/lib/api/types";
import { updateMyProfile } from "@/lib/api/users";
import { formatPhoneInput } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";

import { LogoutButton } from "./LogoutButton";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

interface SettingsPanelProps {
  profile: MeResponse;
  onUpdated(profile: MeResponse): void;
}

export function SettingsPanel({ profile, onUpdated }: SettingsPanelProps) {
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [name, setName] = useState(profile.user.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarHintId = useId();

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (value.length > 100) {
      setNameError(t("profile.nameTooLong"));
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const updated = await updateMyProfile({ name: value });
      onUpdated(updated);
      await refreshUser().catch(() => undefined);
      toast.success(t("profile.nameSaved"));
    } catch (error) {
      setNameError(errorMessage(error));
    } finally {
      setSavingName(false);
    }
  }

  async function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_BYTES) {
      setAvatarError(t("profile.avatarInvalid"));
      return;
    }
    setAvatarError(null);
    // Превью через data: URL (разрешён в CSP img-src), до ответа сервера
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const updated = await updateMyProfile({ avatar: file });
      onUpdated(updated);
      await refreshUser().catch(() => undefined);
      toast.success(t("profile.avatarSaved"));
    } catch (error) {
      setPreview(null);
      setAvatarError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <section aria-labelledby={`${avatarHintId}-title`} className="rounded-card bg-surface p-5 shadow-card">
        <h2 id={`${avatarHintId}-title`} className="text-base font-semibold text-ink">
          {t("profile.avatarLabel")}
        </h2>
        <div className="mt-4 flex items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- локальное превью data: URL
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
              aria-describedby={avatarHintId}
            >
              <Camera className="size-5" aria-hidden />
              {t("profile.avatarUpload")}
            </Button>
            <p id={avatarHintId} className="mt-2 text-[13px] text-muted">
              {t("profile.avatarHint")}
            </p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => void onAvatarChange(event)}
          />
        </div>
        {avatarError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {avatarError}
          </p>
        )}
      </section>

      <form onSubmit={saveName} noValidate className="rounded-card bg-surface p-5 shadow-card">
        <Input
          label={t("profile.nameLabel")}
          placeholder={t("profile.namePlaceholder")}
          value={name}
          maxLength={100}
          autoComplete="name"
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" variant="primary" size="md" className="mt-4" loading={savingName}>
          {t("common.save")}
        </Button>
      </form>

      <dl className="rounded-card bg-surface p-5 shadow-card">
        <dt className="text-sm font-semibold text-ink">{t("profile.phone")}</dt>
        <dd className="mt-1 text-base text-muted">{formatPhoneInput(profile.phone)}</dd>
      </dl>

      <LogoutButton className="w-full sm:w-auto sm:self-start" />
    </div>
  );
}
