import { Skeleton } from "@/components/ui/Skeleton";

export function WizardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-8 h-8 w-full" />
      <Skeleton className="mt-6 h-80 w-full rounded-card" />
      <div className="mt-6 flex justify-end">
        <Skeleton className="h-12 w-48 rounded-[14px]" />
      </div>
    </div>
  );
}
