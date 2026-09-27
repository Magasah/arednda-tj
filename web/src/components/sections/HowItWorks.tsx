import { Container } from "@/components/ui/Container";
import { FadeInUp } from "@/components/ui/FadeInUp";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";

import { StepCard } from "./StepCard";

const steps: { icon: KiroyaIconName; title: string; description: string }[] = [
  {
    icon: "kiroya-location-pin",
    title: "Найди вещь",
    description:
      "Ищи по категории или на карте — рядом с домом всегда найдётся то, что нужно на день или неделю.",
  },
  {
    icon: "kiroya-deposit",
    title: "Оплати безопасно",
    description:
      "Оплата и депозит замораживаются в эскроу. Владелец получит деньги только после передачи вещи.",
  },
  {
    icon: "kiroya-shield-check",
    title: "Получи и верни",
    description:
      "Встреча, фото-акт и QR-подтверждение. Вернул вещь в порядке — депозит сразу возвращается тебе.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="py-16 lg:py-24"
    >
      <Container>
        <SectionHeading
          id="how-it-works-title"
          title="Как это работает"
          description="Три шага от поиска до возврата — без переписок в мессенджерах и риска потерять деньги."
        />

        <ol className="mt-10 grid gap-3 md:grid-cols-3 md:gap-6 lg:mt-14">
          {steps.map((step, index) => (
            <li key={step.title}>
              <FadeInUp index={index} className="h-full">
                <StepCard step={index + 1} {...step} />
              </FadeInUp>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
