import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { TajikPattern } from "@/components/ui/TajikPattern";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

import { HeroAppScreen } from "./HeroAppScreen";
import { HeroEscrowCard } from "./HeroEscrowCard";

const trustBadges = [
  { icon: "kiroya-shield-check", label: t("home.trustMoney") },
  { icon: "kiroya-photo-act", label: t("home.trustPhoto") },
  { icon: "kiroya-star-badge", label: t("home.trustRating") },
] as const;

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-background"
    >
      <Image
        src="/images/hero-bg.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 640px) 100vw, 1px"
        quality={60}
        // На мобиле фото под плотной подложкой почти не видно, а грузится дольше всего — только с sm
        className="hidden object-cover sm:block"
      />
      <div aria-hidden className="absolute inset-0 bg-background/85" />
      <TajikPattern id="hero-ornament" className="text-primary opacity-[0.06]" />

      <Container className="relative pb-14 pt-10 sm:pt-14 lg:pb-20 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="text-center lg:text-left">
            {/* Заголовок — кандидат в LCP: виден сразу, без анимации появления */}
            <h1
              id="hero-title"
              className={cn(
                "text-[40px] font-extrabold leading-[1.05] tracking-tight",
                "text-primary sm:text-[52px] xl:text-[64px]",
              )}
            >
              {t("home.heroTitleLine1")}
              <br />
              {t("home.heroTitleLine2")}
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-bg sm:text-lg lg:mx-0">
              {t("home.heroText")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button href="/catalog">
                {t("home.heroCatalog")}
                <ArrowRight className="size-5" aria-hidden />
              </Button>
              <Button href="/how-it-works" variant="outline">
                {t("home.heroHow")}
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <TajikPattern
              id="hero-ceramic"
              className={cn(
                "!inset-auto right-0 top-4 !size-40 rounded-full",
                "hidden text-accent opacity-[0.15] sm:block",
              )}
            />

            <div className="relative mx-auto w-[72%] max-w-[290px] py-4 sm:w-[64%]">
              <PhoneFrame label={t("home.phoneLabel")}>
                <HeroAppScreen />
              </PhoneFrame>
              <HeroEscrowCard className="absolute -left-6 bottom-20 hidden sm:flex lg:-left-16" />
            </div>
          </div>
        </div>

        <ul className="mt-12 grid gap-3 sm:grid-cols-3 lg:mt-16">
          {trustBadges.map((badge) => (
            <li key={badge.label}>
              <Badge {...badge} className="justify-center sm:justify-start" />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
