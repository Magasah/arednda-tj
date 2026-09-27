"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";

export function LogoutButton({ className }: { className?: string }) {
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await logout();
    } catch {
      // cookie и store всё равно очищены — выходим
    } finally {
      setPending(false);
      toast.success(t("profile.loggedOut"));
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <Button variant="danger" size="md" loading={pending} onClick={() => void onClick()} className={className}>
      <LogOut className="size-5" aria-hidden />
      {t("profile.logout")}
    </Button>
  );
}
