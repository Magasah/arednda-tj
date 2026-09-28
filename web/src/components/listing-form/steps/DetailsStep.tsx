"use client";

import { useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { t } from "@/lib/i18n";

import type { ListingFormValues } from "../schema";

export function DetailsStep() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<ListingFormValues>();
  const description = watch("description") ?? "";

  return (
    <div className="space-y-5">
      <Input
        label={t("wizard.titleLabel")}
        placeholder={t("wizard.titlePlaceholder")}
        hint={t("wizard.titleHint")}
        error={errors.title?.message}
        maxLength={100}
        autoComplete="off"
        {...register("title")}
      />
      <Textarea
        label={t("wizard.descriptionLabel")}
        placeholder={t("wizard.descriptionPlaceholder")}
        error={errors.description?.message}
        maxLength={2000}
        count={description.length}
        rows={6}
        {...register("description")}
      />
    </div>
  );
}
