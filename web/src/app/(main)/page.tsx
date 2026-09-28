import type { Metadata } from "next";

import { CategoriesSection } from "@/components/sections/Categories";
import { CTASection } from "@/components/sections/CTA";
import { HeroSection } from "@/components/sections/Hero";
import { HowItWorksSection } from "@/components/sections/HowItWorks";
import { SafetySection } from "@/components/sections/Safety";
import { JsonLd, organizationJsonLd } from "@/components/seo/JsonLd";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { absolute: t("meta.homeTitle") },
  description: t("meta.homeDescription"),
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <HeroSection />
      <HowItWorksSection />
      <CategoriesSection />
      <SafetySection />
      <CTASection />
    </>
  );
}
