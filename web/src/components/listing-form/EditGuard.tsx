"use client";

import { Lock } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth";

/** Редактировать может только владелец. Это подсказка интерфейса — права проверяет backend */
export function EditGuard({ ownerId, children }: { ownerId: string; children: React.ReactNode }) {
  const userId = useAuthStore((state) => state.user?.id);
  if (userId !== ownerId) {
    return (
      <EmptyState
        tone="error"
        icon={<Lock className="size-6" aria-hidden />}
        title={t("errors.forbidden")}
        text={t("wizard.notOwner")}
        action={
          <Button href="/profile" variant="primary" size="md">
            {t("profile.title")}
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}
