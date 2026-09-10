import Image from "next/image";
import type { SiteContent } from "@bep-nha-minh/shared/types/site";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

type HeroSectionProps = {
  hero: SiteContent["hero"];
  locale: "vi" | "en";
};

export function HeroSection({ hero, locale }: HeroSectionProps) {
  const trustChips = locale === "vi"
    ? ["Nấu mới trong ngày", "Giao tại TP.HCM", "4 khung giao mỗi ngày"]
    : ["Cooked fresh daily", "Delivery in HCMC", "Four delivery windows each day"];
  const imageAlt = locale === "vi"
    ? "Ảnh minh họa hộp cơm gà, gạo lứt và rau củ"
    : "Illustration of a chicken, brown rice, and vegetable meal box";

  return (
    <section
      id="home"
      className="relative overflow-hidden border-b border-olive-700/10 bg-[#f5f5f2] text-olive-900 lg:min-h-[660px]"
    >
      <Image
        src="/hero-meal-prelaunch-v2.png"
        alt={imageAlt}
        fill
        priority
        sizes="(min-width: 1024px) 100vw, 0px"
        className="hidden object-cover object-[60%_center] lg:block"
      />
      <Container className="relative z-10 py-6 lg:py-24">
        <div className="lg:max-w-[42%] xl:max-w-[460px]">
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
            {hero.eyebrow}
          </p>
          <h1 className="max-w-4xl font-serif text-4xl leading-[1.08] text-olive-900 sm:text-5xl md:text-6xl xl:text-7xl">
            {hero.headline}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-olive-900/85 sm:text-lg md:text-xl md:leading-8 lg:mt-6">
            {hero.supportingText}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:mt-8">
            <Button href={`/${locale}/menu`}>{hero.primaryCta}</Button>
            <Button href="#waitlist" variant="secondary">
              {hero.secondaryCta}
            </Button>
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-olive-900 lg:mt-9">
            {trustChips.map((chip) => <li key={chip} className="inline-flex items-center gap-2"><Check className="size-4 text-olive-700" aria-hidden="true" />{chip}</li>)}
          </ul>
        </div>
        <div className="mt-10 hidden max-w-xl border-l-2 border-olive-700 pl-5 lg:block">
          <p className="font-serif text-2xl text-olive-900">{hero.preorderCardTitle}</p>
          <p className="mt-2 text-sm leading-6 text-olive-900/80">{hero.preorderCardText}</p>
          <p className="mt-4 text-xs font-semibold text-muted">{locale === "vi" ? "Ảnh minh họa do AI tạo" : "AI-generated illustrative image"}</p>
        </div>
        </div>
      </Container>
      <div className="relative h-60 sm:h-[300px] lg:hidden">
        <Image
          src="/hero-meal-prelaunch-v2.png"
          alt={imageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[60%_center]"
        />
        <p className="absolute bottom-3 right-4 bg-[#f5f5f2]/90 px-2 py-1 text-xs font-semibold text-muted">{locale === "vi" ? "Ảnh minh họa do AI tạo" : "AI-generated illustrative image"}</p>
      </div>
    </section>
  );
}
