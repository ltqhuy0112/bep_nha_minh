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
        <MotionReveal className="border-y border-olive-700/10 py-8 md:py-10">
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
