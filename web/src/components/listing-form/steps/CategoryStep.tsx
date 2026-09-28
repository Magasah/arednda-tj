"use client";

import { useFormContext } from "react-hook-form";

import { categoryIcon } from "@/components/listing/categoryIcon";
import { KiroyaIcon } from "@/components/ui/KiroyaIcon";
import type { Category } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ListingFormValues } from "../schema";

export function CategoryStep({ categories }: { categories: Category[] }) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<ListingFormValues>();
  const selected = watch("category_slug");
  const error = errors.category_slug?.message;

  return (
    <fieldset
      role="radiogroup"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? "category-error" : "category-hint"}
    >
      <legend className="text-xl font-bold text-ink">{t("wizard.categoryTitle")}</legend>
      <p id="category-hint" className="mt-1 text-[15px] text-muted-bg">
        {t("wizard.categoryHint")}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((category) => {
          const checked = selected === category.slug;
          return (
            <label
              key={category.slug}
              className={cn(
                "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 bg-surface p-4 text-center shadow-card transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                checked ? "border-accent bg-deposit-bg" : "border-transparent hover:border-border",
              )}
            >
              <input
                type="radio"
                value={category.slug}
                className="sr-only"
                {...register("category_slug")}
              />
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-full",
                  checked ? "bg-accent-btn text-surface" : "bg-deposit-bg text-accent-text",
                )}
              >
                <KiroyaIcon name={categoryIcon(category.slug, category.icon)} size={28} />
              </span>
              <span className="text-[15px] font-semibold text-ink">{category.name_ru}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id="category-error" role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
