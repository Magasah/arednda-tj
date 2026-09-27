"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { t } from "@/lib/i18n";

export function CopyLinkButton() {
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("toast.linkCopied"));
    } catch {
      toast.error(t("errors.generic"));
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex min-h-11 items-center gap-2 rounded-[8px] px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
    >
      <Link2 className="size-4" aria-hidden />
      {t("common.copyLink")}
    </button>
  );
}
