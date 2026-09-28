"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { revalidateListing } from "@/app/actions/revalidate";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage, isApiError } from "@/lib/api/errors";
import {
  addListingPhotos,
  createListing,
  deleteListing,
  removeListingPhoto,
  updateListing,
} from "@/lib/api/listings";
import type { Category, ListingDetail } from "@/lib/api/types";
import { compressImage } from "@/lib/compress";
import { t } from "@/lib/i18n";
import { LISTING_LIMIT, limitWait, recordHit } from "@/lib/rateLimit";

import { clearDraft, loadDraft, saveDraft } from "./draft";
import { revokePreviews, type PhotoItem } from "./photos";
import {
  emptyValues,
  listingSchema,
  normalizeMoney,
  PHOTOS_STEP,
  STEP_COUNT,
  STEP_FIELDS,
  toFormData,
  type ListingFormValues,
} from "./schema";
import { StepIndicator } from "./StepIndicator";
import { CategoryStep } from "./steps/CategoryStep";
import { DetailsStep } from "./steps/DetailsStep";
import { LocationStep } from "./steps/LocationStep";
import { PreviewStep } from "./steps/PreviewStep";
import { PriceStep } from "./steps/PriceStep";

// Загрузчик фото (drag-drop, проверка файлов) — отдельный чанк, нужен только на 5-м шаге
const PhotoUploader = dynamic(() => import("./PhotoUploader").then((mod) => mod.PhotoUploader), {
  ssr: false,
  loading: () => <Skeleton className="h-52 w-full rounded-card" />,
});

interface ListingWizardProps {
  mode: "create" | "edit";
  categories: Category[];
  /** Редактирование: текущее объявление */
  listing?: ListingDetail;
}

function valuesFromListing(listing: ListingDetail): ListingFormValues {
  return {
    category_slug: listing.category_slug,
    title: listing.title,
    description: listing.description ?? "",
    price_per_day: String(Number.parseFloat(listing.price_per_day)),
    deposit_amount: String(Number.parseFloat(listing.deposit_amount)),
    city: listing.city,
    lat: listing.lat,
    lng: listing.lng,
  };
}

/** Поле с ошибкой от backend → шаг мастера, где его исправить */
function stepOfField(field: string): number {
  const index = STEP_FIELDS.findIndex((fields) => (fields as string[]).includes(field));
  return index === -1 ? PHOTOS_STEP : index;
}

/**
 * Синхронизировать фото объявления с backend при редактировании:
 * удалить убранные, загрузить новые, сохранить порядок. У объявления всегда остаётся ≥ 1 фото
 * и не больше 8 — поэтому сначала удаляем, а последнее удаляемое — после загрузки новых.
 */
async function syncPhotos(listing: ListingDetail, items: PhotoItem[]): Promise<string[]> {
  let current = [...listing.photos];
  const keep = new Set(items.flatMap((item) => (item.kind === "existing" ? [item.url] : [])));
  const removed = current.filter((url) => !keep.has(url));
  const deferred = keep.size === 0 ? removed.pop() : undefined;

  const removeUrl = async (url: string) => {
    const detail = await removeListingPhoto(listing.id, current.indexOf(url));
    current = detail.photos;
  };

  for (const url of removed) await removeUrl(url);

  const fresh = items.filter((item): item is Extract<PhotoItem, { kind: "new" }> => item.kind === "new");
  const uploaded = new Map<string, string>();
  if (fresh.length) {
    const files = await Promise.all(fresh.map((item) => compressImage(item.file)));
    const before = new Set(current);
    const detail = await addListingPhotos(listing.id, files);
    current = detail.photos;
    const added = current.filter((url) => !before.has(url));
    fresh.forEach((item, index) => {
      if (added[index]) uploaded.set(item.id, added[index]);
    });
  }

  if (deferred) await removeUrl(deferred);

  return items.flatMap((item) => {
    const url = item.kind === "existing" ? item.url : uploaded.get(item.id);
    return url && current.includes(url) ? [url] : [];
  });
}

export function ListingWizard({ mode, categories, listing }: ListingWizardProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    (listing?.photos ?? []).map((url, index) => ({ id: `existing-${index}`, kind: "existing", url })),
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restored, setRestored] = useState(mode === "edit");

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: listing ? valuesFromListing(listing) : emptyValues,
    mode: "onTouched",
  });
  const { handleSubmit, trigger, reset, watch, setError, getValues } = form;

  // Черновик: восстановить при входе (фото не сохраняются — вернём на шаг фото, если ушли дальше)
  useEffect(() => {
    if (mode !== "create") return;
    const draft = loadDraft();
    if (draft) {
      reset(draft.values);
      setStep(Math.min(draft.step, PHOTOS_STEP));
      if (draft.values.title || draft.values.category_slug) toast(t("wizard.draftRestored"));
    }
    setRestored(true);
  }, [mode, reset]);

  useEffect(() => {
    if (mode !== "create" || !restored) return;
    saveDraft({ values: getValues(), step });
    const subscription = watch((values) => saveDraft({ values: values as ListingFormValues, step }));
    return () => subscription.unsubscribe();
  }, [mode, restored, step, watch, getValues]);

  // Освободить превью фото при уходе со страницы
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => revokePreviews(photosRef.current), []);

  const goTo = useCallback((next: number) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => headingRef.current?.focus());
  }, []);

  async function next() {
    const valid = await trigger(STEP_FIELDS[step], { shouldFocus: true });
    if (!valid) return;
    if (step === PHOTOS_STEP && photos.length === 0) {
      setPhotoError(t("wizard.photosRequired"));
      return;
    }
    goTo(Math.min(step + 1, STEP_COUNT - 1));
  }

  function showServerErrors(error: unknown) {
    if (isApiError(error) && Object.keys(error.fields).length) {
      let target = STEP_COUNT - 1;
      for (const [field, message] of Object.entries(error.fields)) {
        const name = field.split(".").pop() ?? field;
        if (name in emptyValues) setError(name as FieldPath<ListingFormValues>, { message });
        target = Math.min(target, stepOfField(name));
      }
      goTo(target);
    }
    toast.error(mode === "create" ? t("wizard.createError") : t("errors.generic"), {
      description: errorMessage(error),
    });
  }

  async function publish(values: ListingFormValues) {
    if (photos.length === 0) {
      setPhotoError(t("wizard.photosRequired"));
      goTo(PHOTOS_STEP);
      return;
    }
    if (mode === "create") {
      const wait = limitWait(LISTING_LIMIT.key, LISTING_LIMIT.max, LISTING_LIMIT.windowMs);
      if (wait > 0) {
        toast.error(t("wizard.rateLimited", { minutes: Math.ceil(wait / 60000) }));
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const data = toFormData(values);
        const files = await Promise.all(
          photos.map((item) => (item.kind === "new" ? compressImage(item.file) : null)),
        );
        for (const file of files) if (file) data.append("photos", file, file.name);
        const created = await createListing(data);
        recordHit(LISTING_LIMIT.key, LISTING_LIMIT.windowMs);
        clearDraft();
        await revalidateListing(created.id).catch(() => undefined);
        toast.success(t("wizard.created"));
        router.push(`/listing/${created.id}`);
        return;
      }

      if (!listing) return;
      const order = await syncPhotos(listing, photos);
      await updateListing(listing.id, {
        category_slug: values.category_slug,
        title: values.title.trim(),
        description: values.description.trim() || null,
        price_per_day: normalizeMoney(values.price_per_day),
        deposit_amount: normalizeMoney(values.deposit_amount || "0"),
        city: values.city,
        lat: values.lat,
        lng: values.lng,
        photos: order,
      });
      await revalidateListing(listing.id).catch(() => undefined);
      toast.success(t("wizard.updated"));
      router.push(`/listing/${listing.id}`);
      router.refresh();
    } catch (error) {
      showServerErrors(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!listing) return;
    setDeleting(true);
    try {
      await deleteListing(listing.id);
      await revalidateListing(listing.id).catch(() => undefined);
      toast.success(t("wizard.deleted"));
      router.push("/profile?tab=listings");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const last = step === STEP_COUNT - 1;

  return (
    <FormProvider {...form}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-ink focus:outline-none sm:text-3xl">
            {mode === "create" ? t("wizard.newTitle") : t("wizard.editTitle")}
          </h1>
          {mode === "create" && step > 0 && (
            <button
              type="button"
              onClick={() => {
                clearDraft();
                reset(emptyValues);
                revokePreviews(photos);
                setPhotos([]);
                goTo(0);
              }}
              className="min-h-11 shrink-0 rounded-[8px] px-2 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              {t("wizard.resetDraft")}
            </button>
          )}
        </div>

        <div className="mt-6">
          <StepIndicator step={step} total={STEP_COUNT} onSelect={goTo} />
        </div>

        <form
          noValidate
          className="mt-6"
          // Enter в поле = «Далее», на последнем шаге — «Опубликовать»
          onSubmit={(event) => {
            if (!last) {
              event.preventDefault();
              void next();
              return;
            }
            void handleSubmit(publish, (errors) => {
              goTo(Math.min(...Object.keys(errors).map(stepOfField)));
            })(event);
          }}
        >
          <div className="rounded-card bg-surface p-5 shadow-card sm:p-8">
            {step === 0 && <CategoryStep categories={categories} />}
            {step === 1 && <DetailsStep />}
            {step === 2 && <PriceStep />}
            {step === 3 && <LocationStep />}
            {step === PHOTOS_STEP && (
              <div>
                <h2 className="mb-4 text-xl font-bold text-ink">{t("wizard.photosTitle")}</h2>
                <PhotoUploader
                  items={photos}
                  disabled={submitting}
                  error={photoError}
                  onChange={(items) => {
                    setPhotos(items);
                    if (items.length) setPhotoError(null);
                  }}
                />
              </div>
            )}
            {last && <PreviewStep categories={categories} photos={photos} onEdit={goTo} />}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              size="md"
              disabled={step === 0 || submitting}
              onClick={() => goTo(Math.max(0, step - 1))}
              className={step === 0 ? "invisible" : undefined}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("wizard.back")}
            </Button>
            <Button type="submit" variant="accent" size="md" loading={submitting} className="sm:min-w-48">
              {last
                ? submitting
                  ? mode === "create"
                    ? t("wizard.publishing")
                    : t("wizard.saving")
                  : mode === "create"
                    ? t("wizard.publish")
                    : t("wizard.save")
                : t("wizard.next")}
              {!last && <ArrowRight className="size-4" aria-hidden />}
            </Button>
          </div>
        </form>

        {mode === "edit" && listing && (
          <div className="mt-10 border-t border-border pt-6">
            <Button variant="ghost" size="md" onClick={() => setDeleteOpen(true)} className="text-danger hover:bg-danger/5">
              <Trash2 className="size-4" aria-hidden />
              {t("wizard.deleteListing")}
            </Button>
            <Modal
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title={t("wizard.deleteConfirmTitle")}
              description={t("wizard.deleteConfirmText")}
              footer={
                <>
                  <Button variant="outline" size="md" onClick={() => setDeleteOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button variant="danger" size="md" loading={deleting} onClick={() => void onDelete()}>
                    {t("wizard.deleteConfirm")}
                  </Button>
                </>
              }
            />
          </div>
        )}
      </div>
    </FormProvider>
  );
}
