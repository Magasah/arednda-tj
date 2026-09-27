import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { FadeInUp } from "@/components/ui/FadeInUp";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { TajikPattern } from "@/components/ui/TajikPattern";
import { cn } from "@/lib/utils";

import { HeroAppScreen } from "./HeroAppScreen";
import { HeroEscrowCard } from "./HeroEscrowCard";

const trustBadges = [
  { icon: "kiroya-shield-check", label: "Деньги защищены" },
  { icon: "kiroya-photo-act", label: "Фото-акт" },
  { icon: "kiroya-star-badge", label: "Рейтинг мастеров" },
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
        sizes="100vw"
        quality={60}
        className="object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-background/85" />
      <TajikPattern id="hero-ornament" className="text-primary opacity-[0.06]" />

      <Container className="relative pb-14 pt-10 sm:pt-14 lg:pb-20 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="text-center lg:text-left">
            <FadeInUp>
              <h1
                id="hero-title"
                className={cn(
                  "text-[40px] font-extrabold leading-[1.05] tracking-tight",
                  "text-primary sm:text-[52px] xl:text-[64px]",
                )}
              >
                Арендуй всё —<br />
                рядом с тобой
              </h1>
            </FadeInUp>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
              Безопасная аренда вещей от людей рядом. Электроника, инструменты, камеры,
              транспорт и многое другое — в вашем городе.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button href="#download">
                Скачать приложение
                <ArrowRight className="size-5" aria-hidden />
              </Button>
              <Button href="#how-it-works" variant="outline">
                Как это работает
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
              <PhoneFrame label="Экран приложения KIROYA: объявления аренды в Душанбе">
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
