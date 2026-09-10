import type { SiteContent } from "@bep-nha-minh/shared/types/site";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/motion/motion-reveal";

type SocialSectionProps = {
  social: SiteContent["social"];
};

export function SocialSection({ social }: SocialSectionProps) {
  return (
    <section id="contact" className="botanical-section botanical-soft py-16 md:py-24">
      <Container>
        <MotionReveal className="rounded-[28px] border border-olive-700/10 bg-white p-7 shadow-soft md:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <SectionHeading title={social.title} description={social.description} />
            <div className="flex flex-wrap gap-3">
              {social.links.map((link) => (
                <Button
                  key={link.label}
                  href={link.href}
                  variant="secondary"
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                </Button>
              ))}
            </div>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
