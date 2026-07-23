import type { SiteContent } from "@/types/site";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { MotionReveal } from "@/components/motion/motion-reveal";

type StorySectionProps = {
  story: SiteContent["story"];
};

export function StorySection({ story }: StorySectionProps) {
  return (
    <section id="story" className="bg-white/55 py-16 md:py-24">
      <Container className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <MotionReveal>
          <SectionHeading eyebrow={story.eyebrow} title={story.title} />
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <div className="rounded-[28px] border border-olive-700/10 bg-cream-100 p-7 shadow-soft md:p-9">
            <div className="space-y-5 text-base leading-8 text-muted md:text-lg">
              {story.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="mt-7 rounded-3xl bg-beige-200/70 p-5 text-sm leading-6 text-olive-900">
              {story.note}
            </p>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
