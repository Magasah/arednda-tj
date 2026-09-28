"use client";

import { Eye, EyeOff, PackageOpen, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { revalidateListing } from "@/app/actions/revalidate";
import { categoryIcon } from "@/components/listing/categoryIcon";
import { gridClasses } from "@/components/listing/grid";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { KiroyaIcon } from "@/components/ui/KiroyaIcon";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import { deleteListing, getMyListings, setListingStatus } from "@/lib/api/listings";
import type { MyListing } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

function ListingsSkeleton() {
  return (
    <ul className={gridClasses} aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index}>
          <Skeleton className="aspect-[4/3] w-full rounded-card" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </li>
      ))}
    </ul>
  );
}

export function MyListingsTab() {
  const router = useRouter();
  const [items, setItems] = useState<MyListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<MyListing | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getMyListings()
      .then(setItems)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);

  /** Оптимистично: статус меняется сразу, при ошибке — откат */
  async function toggleHidden(listing: MyListing) {
    const next = listing.status === "inactive" ? "active" : "inactive";
    setItems((current) => current?.map((item) => (item.id === listing.id ? { ...item, status: next } : item)) ?? null);
    try {
      await setListingStatus(listing.id, next);
      await revalidateListing(listing.id).catch(() => undefined);
      toast.success(next === "inactive" ? t("account.hiddenToast") : t("account.shownToast"));
    } catch (err) {
      setItems(
        (current) =>
          current?.map((item) => (item.id === listing.id ? { ...item, status: listing.status } : item)) ?? null,
      );
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const removed = toDelete;
    setDeleting(true);
    setItems((current) => current?.filter((item) => item.id !== removed.id) ?? null);
    try {
      await deleteListing(removed.id);
      await revalidateListing(removed.id).catch(() => undefined);
      toast.success(t("wizard.deleted"));
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(err));
      load();
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        tone="error"
        title={t("errors.generic")}
        text={error}
        action={
          <Button variant="primary" size="md" onClick={load}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }
  if (!items) return <ListingsSkeleton />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<PackageOpen className="size-7" aria-hidden />}
        title={t("profile.listingsEmptyTitle")}
        text={t("account.listingsEmptyText")}
        action={
          <Button href="/listing/new" variant="accent" size="md">
            <Plus className="size-5" aria-hidden />
            {t("wizard.ctaLong")}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button href="/listing/new" variant="accent" size="sm">
          <Plus className="size-4" aria-hidden />
          {t("wizard.cta")}
        </Button>
      </div>
      <ul className={gridClasses}>
        {items.map((listing) => {
          const photo = mediaUrl(listing.photos[0]);
          const hidden = listing.status === "inactive";
          return (
            <li key={listing.id} className="relative">
              <ActionMenu
                className="absolute right-2 top-2 z-10"
                label={t("account.listingActions", { title: listing.title })}
                items={[
                  {
                    label: t("account.edit"),
                    icon: <Pencil className="size-4" aria-hidden />,
                    onSelect: () => router.push(`/listing/${listing.id}/edit`),
                  },
                  {
                    label: hidden ? t("account.show") : t("account.hide"),
                    icon: hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />,
                    onSelect: () => void toggleHidden(listing),
                  },
                  {
                    label: t("account.delete"),
                    icon: <Trash2 className="size-4" aria-hidden />,
                    tone: "danger",
                    onSelect: () => setToDelete(listing),
                  },
                ]}
              />
              <article className="relative flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card">
                <div className={cn("relative aspect-[4/3] w-full bg-deposit-bg", hidden && "opacity-60")}>
                  {photo ? (
                    <Image
                      src={photo}
                      alt={listing.title}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-accent-text">
                      <KiroyaIcon name={categoryIcon(listing.category_slug)} size={40} />
                    </span>
                  )}
                </div>
                {listing.status !== "active" && (
                  <span
                    className={cn(
                      "absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold",
                      hidden ? "bg-ink text-surface" : "bg-primary text-surface",
                    )}
                  >
                    {hidden ? t("account.hidden") : t("account.rented")}
                  </span>
                )}
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
                    <Link href={`/listing/${listing.id}`} className="hover:text-primary">
                      {listing.title}
                    </Link>
                  </h3>
                  <p className="text-base font-bold text-accent-text">
                    {t("common.perDay", { price: formatMoney(listing.price_per_day) })}
                  </p>
                  <p className="text-[13px] text-muted">{listing.city}</p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      <Modal
        open={toDelete !== null}
        onOpenChange={(open) => !open && !deleting && setToDelete(null)}
        title={t("wizard.deleteConfirmTitle")}
        description={t("wizard.deleteConfirmText")}
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setToDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="md" loading={deleting} onClick={() => void confirmDelete()}>
              {t("wizard.deleteConfirm")}
            </Button>
          </>
        }
      />
    </>
  );
}
