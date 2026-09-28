import { Container } from "@/components/ui/Container";
import { FadeInUp } from "@/components/ui/FadeInUp";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { CategoryCard } from "./CategoryCard";

const categories: { icon: KiroyaIconName; label: string; hint: string; href: string }[] = [
  { icon: "kiroya-laptop", label: t("categories.tech"), hint: t("home.categoryHints.tech"), href: "/catalog/tech" },
  { icon: "kiroya-wrench", label: t("categories.tools"), hint: t("home.categoryHints.tools"), href: "/catalog/tools" },
  { icon: "kiroya-scooter", label: t("categories.transport"), hint: t("home.categoryHints.transport"), href: "/catalog/transport" },
  { icon: "kiroya-camera", label: t("categories.photo"), hint: t("home.categoryHints.photo"), href: "/catalog/photo" },
  { icon: "kiroya-tent", label: t("categories.events"), hint: t("home.categoryHints.events"), href: "/catalog/events" },
  { icon: "kiroya-home", label: t("home.categoryHome"), hint: t("home.categoryHints.home"), href: "/catalog" },
];

export function CategoriesSection() {
  return (
    <section
      id="categories"
      aria-labelledby="categories-title"
      className="py-16 lg:py-24"
    >
      <Container>
        <SectionHeading
          id="categories-title"
          title={t("home.categoriesTitle")}
          description={t("home.categoriesText")}
        />
      </Container>

      <ul
        className={cn(
          "mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:px-6 lg:mx-auto lg:mt-14 lg:grid lg:max-w-content lg:grid-cols-6",
          "lg:gap-4 lg:overflow-visible lg:px-8",
        )}
      >
        {categories.map((category, index) => (
          <li
            key={category.label}
            className="w-[42%] shrink-0 snap-start sm:w-[28%] lg:w-auto"
          >
            <FadeInUp index={index} className="h-full">
              <CategoryCard {...category} />
            </FadeInUp>
          </li>
        ))}
      </ul>
    </section>
  );
}
