import type { SiteContent } from "@/types/site";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { WaitlistForm } from "@/components/forms/waitlist-form";
import { MotionReveal } from "@/components/motion/motion-reveal";

type WaitlistSectionProps = {
  waitlist: SiteContent["waitlist"];
};

export function WaitlistSection({ waitlist }: WaitlistSectionProps) {
  return (
    <section
      id="waitlist"
      className="botanical-section botanical-frame botanical-warm py-16 md:py-24"
    >
      <Container className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-start">
        <MotionReveal>
          <SectionHeading
            eyebrow={waitlist.eyebrow}
            title={waitlist.title}
            description={waitlist.description}
          />
          <div className="mt-8 rounded-[24px] border border-olive-700/10 bg-cream-100 p-6 text-sm leading-6 text-muted">
            <p>{waitlist.note}</p>
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <div className="rounded-[28px] border border-olive-700/10 bg-cream-100 p-5 shadow-soft md:p-7">
            <WaitlistForm labels={waitlist.form} successMessage={waitlist.successMessage} />
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
