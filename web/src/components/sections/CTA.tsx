import { Container } from "@/components/ui/Container";
import { FadeInUp } from "@/components/ui/FadeInUp";
import { StoreButton } from "@/components/ui/StoreButton";
import { TajikPattern } from "@/components/ui/TajikPattern";

export function CTASection() {
  return (
    <section
      id="download"
      aria-labelledby="download-title"
      className="py-16 lg:py-24"
    >
      <Container>
        <FadeInUp>
          <div className="relative overflow-hidden rounded-[24px] bg-surface px-6 py-12 text-center shadow-card sm:px-12 lg:py-16">
            <TajikPattern id="cta-ornament" className="text-primary opacity-[0.04]" />

            <div className="relative">
              <h2
                id="download-title"
                className="text-[32px] font-extrabold leading-tight tracking-tight text-primary sm:text-5xl"
              >
                Готов арендовать?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
                Скачай KIROYA и найди нужную вещь в пару касаний. Или сдай свою —
                и зарабатывай на том, что лежит без дела.
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <StoreButton store="app-store" href="#download" className="w-full sm:w-auto" />
                <StoreButton store="google-play" href="#download" className="w-full sm:w-auto" />
              </div>
            </div>
          </div>
        </FadeInUp>
      </Container>
    </section>
  );
}
