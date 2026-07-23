import Image from "next/image";
import type { SiteContent } from "@/types/site";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/motion/motion-reveal";

type HeroSectionProps = {
  hero: SiteContent["hero"];
};

export function HeroSection({ hero }: HeroSectionProps) {
  return (
    <section id="home" className="overflow-hidden pb-16 pt-10 md:pb-24 md:pt-16">
      <Container className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <MotionReveal>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
            {hero.eyebrow}
          </p>
          <h1 className="font-serif text-5xl leading-[1.04] text-olive-900 md:text-7xl">
            {hero.headline}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted md:text-xl">
            {hero.supportingText}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="#contact">{hero.primaryCta}</Button>
            <Button href="#waitlist" variant="secondary">
              {hero.secondaryCta}
            </Button>
          </div>
        </MotionReveal>

        <MotionReveal delay={0.08} className="relative">
          <div className="absolute -left-6 top-8 hidden rounded-full border border-olive-700/20 px-5 py-3 text-sm font-semibold text-olive-900 md:block">
            {hero.floatingLabel}
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-olive-700/10 bg-beige-200 shadow-soft">
            <Image
              src={hero.image}
              alt={hero.alt}
              fill
              priority
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-5 right-4 rounded-3xl bg-cream-100 px-5 py-4 shadow-soft">
            <p className="font-serif text-xl text-olive-900">{hero.preorderCardTitle}</p>
            <p className="mt-1 text-sm text-muted">{hero.preorderCardText}</p>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
