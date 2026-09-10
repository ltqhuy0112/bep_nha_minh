import Image from "next/image";
import type { Dish } from "@bep-nha-minh/shared/types/site";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { MotionReveal } from "@/components/motion/motion-reveal";

type DishGridProps = {
  dishes: Dish[];
  heading: {
    eyebrow: string;
    title: string;
    description: string;
    badge: string;
  };
};

export function DishGrid({ dishes, heading }: DishGridProps) {
  return (
    <section id="meals" className="botanical-section botanical-soft py-16 md:py-24">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow={heading.eyebrow}
            title={heading.title}
            description={heading.description}
          />
          <p className="rounded-full bg-olive-700/10 px-4 py-2 text-sm font-semibold text-olive-900">
            {heading.badge}
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {dishes.map((dish, index) => (
            <MotionReveal key={dish.name} delay={index * 0.04}>
              <article className="group h-full overflow-hidden rounded-[24px] border border-olive-700/10 bg-white shadow-soft">
                <div className="relative aspect-[4/3] overflow-hidden bg-beige-200">
                  <Image
                    src={dish.image}
                    alt={dish.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-wood-500">
                    {dish.tag}
                  </span>
                  <h3 className="mt-2 font-serif text-xl leading-tight text-olive-900">
                    {dish.name}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{dish.description}</p>
                </div>
              </article>
            </MotionReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
