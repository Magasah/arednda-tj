import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { CategoriesSection } from "@/components/sections/Categories";
import { CTASection } from "@/components/sections/CTA";
import { HeroSection } from "@/components/sections/Hero";
import { HowItWorksSection } from "@/components/sections/HowItWorks";
import { SafetySection } from "@/components/sections/Safety";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <>
      <a
        href="#main"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:left-4 focus:top-4 focus:z-50",
          "focus:rounded-[8px] focus:bg-surface focus:px-4 focus:py-2",
        )}
      >
        Перейти к содержимому
      </a>
      <Navbar />
      <main id="main">
        <HeroSection />
        <HowItWorksSection />
        <CategoriesSection />
        <SafetySection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
