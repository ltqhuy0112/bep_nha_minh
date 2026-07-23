import Image from "next/image";
import type { GalleryItem } from "@/types/site";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { MotionReveal } from "@/components/motion/motion-reveal";

type KitchenGalleryProps = {
  items: GalleryItem[];
  heading: {
    eyebrow: string;
    title: string;
  };
};

export function KitchenGallery({ items, heading }: KitchenGalleryProps) {
  return (
    <section className="botanical-section botanical-soft py-16 md:py-24">
      <Container>
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          align="center"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {items.map((item, index) => (
            <MotionReveal key={item.title} delay={index * 0.05}>
              <article className="overflow-hidden rounded-[24px] border border-olive-700/10 bg-white shadow-soft">
                <div className="relative aspect-[5/4] bg-beige-200">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-2xl text-olive-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{item.description}</p>
                </div>
              </article>
            </MotionReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
