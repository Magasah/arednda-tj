import { Container } from "@/components/ui/Container";
import { FadeInUp } from "@/components/ui/FadeInUp";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TajikPattern } from "@/components/ui/TajikPattern";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";

import { SafetyFeature } from "./SafetyFeature";

const features: { icon: KiroyaIconName; title: string; description: string }[] = [
  {
    icon: "kiroya-shield-check",
    title: "Эскроу",
    description:
      "Оплата и депозит замораживаются до передачи вещи. Никто не получит деньги раньше времени — ни арендатор, ни владелец.",
  },
  {
    icon: "kiroya-photo-act",
    title: "Фото-акт",
    description:
      "При передаче и возврате обе стороны фотографируют вещь в приложении. Если возник спор — есть доказательства.",
  },
  {
    icon: "kiroya-star-badge",
    title: "ML-антифрод",
    description:
      "Система анализирует поведение и отзывы, отсеивает фейковые аккаунты и накрутку рейтинга ещё до сделки.",
  },
];

export function SafetySection() {
  return (
    <section
      id="safety"
      aria-labelledby="safety-title"
      className="relative overflow-hidden bg-primary py-16 lg:py-24"
    >
      <TajikPattern id="safety-ornament" className="text-surface opacity-[0.05]" />

      <Container className="relative">
        <SectionHeading
          id="safety-title"
          title="Безопасность на каждом шаге"
          description="Мы отвечаем за сделку, чтобы вам не пришлось доверять незнакомцам на слово."
          inverse
        />

        <ul className="mt-10 grid gap-3 md:grid-cols-3 md:gap-6 lg:mt-14">
          {features.map((feature, index) => (
            <li key={feature.title}>
              <FadeInUp index={index} className="h-full">
                <SafetyFeature {...feature} />
              </FadeInUp>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
