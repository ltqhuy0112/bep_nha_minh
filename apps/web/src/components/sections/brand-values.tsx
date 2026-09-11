import type { BrandValue } from "@bep-nha-minh/shared/types/site";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { Clock3, Leaf, Recycle, Soup } from "lucide-react";

type BrandValuesProps = {
  values: BrandValue[];
  heading: {
    eyebrow: string;
    title: string;
  };
};

const iconMap = {
  leaf: Leaf,
  bowl: Soup,
  cycle: Recycle,
  clock: Clock3
};

export function BrandValues({ values, heading }: BrandValuesProps) {
  return (
    <section className="botanical-section botanical-soft py-16 md:py-20">
      <Container>
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          align="center"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value, index) => (
            <MotionReveal key={value.title} delay={index * 0.04}>
              <article className="h-full border-t border-olive-700/15 py-6">
                <span className="inline-flex size-11 items-center justify-center text-olive-900">
                  {(() => { const Icon = iconMap[value.icon as keyof typeof iconMap] ?? Leaf; return <Icon aria-hidden="true" className="size-6" />; })()}
                </span>
                <h3 className="mt-5 font-serif text-2xl leading-tight text-olive-900">
                  {value.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">{value.description}</p>
              </article>
            </MotionReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
