import type { BrandValue } from "@/types/site";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { MotionReveal } from "@/components/motion/motion-reveal";

type BrandValuesProps = {
  values: BrandValue[];
  heading: {
    eyebrow: string;
    title: string;
  };
};

const iconMap: Record<string, string> = {
  leaf: "Leaf",
  bowl: "Bowl",
  cycle: "Reuse",
  clock: "Clock"
};

export function BrandValues({ values, heading }: BrandValuesProps) {
  return (
    <section className="py-16 md:py-20">
      <Container>
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          align="center"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value, index) => (
            <MotionReveal key={value.title} delay={index * 0.04}>
              <article className="h-full rounded-[24px] border border-olive-700/10 bg-white/70 p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-hover">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-olive-700/10 text-xs font-bold text-olive-900">
                  {iconMap[value.icon] || "Note"}
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
