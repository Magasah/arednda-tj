"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/Skeleton";

// Форма входа грузится отдельным чанком только на /login (ssr: false — в ней только клиентская логика)
export const LoginFormLazy = dynamic(() => import("./LoginForm").then((mod) => mod.LoginForm), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-card bg-surface p-6 shadow-card sm:p-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-8 h-12 w-full" />
      <Skeleton className="mt-6 h-12 w-full" />
    </div>
  ),
});
