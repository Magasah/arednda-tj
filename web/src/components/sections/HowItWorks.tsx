import { Container } from "@/components/ui/Container";
import { FadeInUp } from "@/components/ui/FadeInUp";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";
import { t } from "@/lib/i18n";

import { StepCard } from "./StepCard";

const steps: { icon: KiroyaIconName; title: string; description: string }[] = [
  { icon: "kiroya-location-pin", title: t("home.step1Title"), description: t("home.step1Text") },
  { icon: "kiroya-deposit", title: t("home.step2Title"), description: t("home.step2Text") },
  { icon: "kiroya-shield-check", title: t("home.step3Title"), description: t("home.step3Text") },
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
          title={t("home.howTitle")}
          description={t("home.howText")}
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
