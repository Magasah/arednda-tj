import { Container } from "@/components/ui/Container";
import { FadeInUp } from "@/components/ui/FadeInUp";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TajikPattern } from "@/components/ui/TajikPattern";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";
import { t } from "@/lib/i18n";

import { SafetyFeature } from "./SafetyFeature";

const features: { icon: KiroyaIconName; title: string; description: string }[] = [
  {
    icon: "kiroya-shield-check",
    title: t("home.safetyEscrowTitle"),
    description: t("home.safetyEscrowText"),
  },
  {
    icon: "kiroya-photo-act",
    title: t("home.safetyPhotoTitle"),
    description: t("home.safetyPhotoText"),
  },
  {
    icon: "kiroya-star-badge",
    title: t("home.safetyFraudTitle"),
    description: t("home.safetyFraudText"),
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
          title={t("home.safetyTitle")}
          description={t("home.safetyText")}
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
