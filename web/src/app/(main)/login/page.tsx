import type { Metadata } from "next";

import { LoginFormLazy } from "@/components/auth/LoginFormLazy";
import { safeNextPath } from "@/lib/auth/routes";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

interface LoginPageProps {
  searchParams: { next?: string | string[] };
}

export const metadata: Metadata = pageMetadata({
  title: t("meta.loginTitle"),
  description: t("meta.loginDescription"),
  path: "/login",
  noIndex: true,
});

export default function LoginPage({ searchParams }: LoginPageProps) {
  const next = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next;

  return (
    <div className="flex justify-center bg-background px-4 py-10 sm:py-16">
      <div className="w-full max-w-[400px]">
        <LoginFormLazy nextPath={safeNextPath(next)} />
      </div>
    </div>
  );
}
