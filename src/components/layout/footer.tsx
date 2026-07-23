import type { SocialLink } from "@/types/site";
import { Container } from "@/components/layout/container";

type FooterProps = {
  links: SocialLink[];
  description: string;
};

export function Footer({ links, description }: FooterProps) {
  return (
    <footer className="border-t border-olive-700/10 bg-olive-900 py-10 text-cream-100">
      <Container className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-serif text-2xl">Bếp Nhà Mình</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-cream-100/75">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-full border border-cream-100/20 px-4 py-2 text-sm font-semibold text-cream-100 transition hover:bg-cream-100 hover:text-olive-900"
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
            </a>
          ))}
        </div>
      </Container>
    </footer>
  );
}
