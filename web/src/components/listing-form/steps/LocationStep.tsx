"use client";

import { MapPin, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useId } from "react";
import { useFormContext } from "react-hook-form";

import { Skeleton } from "@/components/ui/Skeleton";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { CITIES, type ListingFormValues } from "../schema";

// Leaflet — только в браузере и только на этом шаге
const LocationMap = dynamic(() => import("../LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="relative h-72 sm:h-80">
      <Skeleton className="size-full rounded-card" />
      <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">
        {t("wizard.mapLoading")}
      </span>
    </div>
  ),
});

export function LocationStep() {
  const selectId = useId();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ListingFormValues>();
  const [city, lat, lng] = watch(["city", "lat", "lng"]);
  const error = errors.city?.message;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold text-ink">
          {t("wizard.cityLabel")}
        </label>
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={cn(
            "h-12 w-full rounded-[12px] border bg-surface px-4 text-base text-ink focus-visible:border-primary",
            error ? "border-danger" : "border-border",
          )}
          {...register("city")}
        >
          {CITIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} role="alert" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">{t("wizard.mapLabel")}</p>
        <p className="mb-3 text-[13px] leading-relaxed text-muted-bg">{t("wizard.mapHint")}</p>
        <LocationMap
          city={city}
          lat={lat}
          lng={lng}
          label={t("wizard.mapLabel")}
          onPick={(nextLat, nextLng) => {
            setValue("lat", nextLat, { shouldDirty: true });
            setValue("lng", nextLng, { shouldDirty: true });
          }}
        />
        {lat != null && lng != null && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink" aria-live="polite">
            <MapPin className="size-4 text-accent-text" aria-hidden />
            {t("wizard.mapPicked", { lat: lat.toFixed(4), lng: lng.toFixed(4) })}
            <button
              type="button"
              onClick={() => {
                setValue("lat", null, { shouldDirty: true });
                setValue("lng", null, { shouldDirty: true });
              }}
              className="inline-flex min-h-11 items-center gap-1 rounded-[8px] px-2 font-semibold text-primary hover:bg-primary/5"
            >
              <X className="size-4" aria-hidden />
              {t("wizard.mapClear")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
