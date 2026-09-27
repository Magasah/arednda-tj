import { Container } from "@/components/ui/Container";
import { FadeInUp } from "@/components/ui/FadeInUp";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";
import { cn } from "@/lib/utils";

import { CategoryCard } from "./CategoryCard";

const categories: { icon: KiroyaIconName; label: string; hint: string }[] = [
  { icon: "kiroya-laptop", label: "Техника", hint: "ноутбуки, планшеты" },
  { icon: "kiroya-wrench", label: "Инструменты", hint: "перфораторы, сварка" },
  { icon: "kiroya-scooter", label: "Транспорт", hint: "самокаты, велосипеды" },
  { icon: "kiroya-camera", label: "Фото и видео", hint: "камеры, объективы" },
  { icon: "kiroya-tent", label: "Мероприятия", hint: "звук, свет, проекторы" },
  { icon: "kiroya-home", label: "Для дома", hint: "уборка, ремонт, дача" },
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
          title="Категории"
          description="Зачем покупать то, что нужно на пару дней? Возьми у соседа."
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
