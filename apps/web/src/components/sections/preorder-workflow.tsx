import type { WorkflowStep } from "@bep-nha-minh/shared/types/site";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { MotionReveal } from "@/components/motion/motion-reveal";

type PreorderWorkflowProps = {
  workflow: WorkflowStep[];
  heading: {
    eyebrow: string;
    title: string;
    description: string;
  };
};

export function PreorderWorkflow({ workflow, heading }: PreorderWorkflowProps) {
  return (
    <section id="workflow" className="bg-olive-900 py-16 text-cream-100 md:py-24">
      <Container>
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          description={heading.description}
        />

        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {workflow.map((item, index) => (
            <MotionReveal key={item.step} delay={index * 0.04}>
              <article className="h-full rounded-[24px] border border-cream-100/15 bg-cream-100/7 p-5">
                <span className="text-sm font-bold text-beige-200">{item.step}</span>
                <h3 className="mt-5 font-serif text-2xl leading-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-cream-100/75">
                  {item.description}
                </p>
              </article>
            </MotionReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
