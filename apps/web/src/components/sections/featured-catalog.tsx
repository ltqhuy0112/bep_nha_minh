"use client";

import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { useCatalogProducts } from "@/features/catalog/hooks/use-catalog";
import { formatPrice, getProductPresentation } from "@/features/catalog/presentation";
import type { CatalogLocale } from "@/features/catalog/types";

type FeaturedCatalogProps = {
  locale: CatalogLocale;
};

export function FeaturedCatalog({ locale }: FeaturedCatalogProps) {
  const { data, error, loading, retry } = useCatalogProducts(locale, 1);
  const copy = locale === "vi"
    ? { eyebrow: "Thực đơn dự kiến", title: "Món bếp đang hoàn thiện", description: "Các món đang được bếp hoàn thiện theo từng đợt.", price: "Giá dự kiến", view: "Xem món", all: "Xem toàn bộ thực đơn dự kiến", retry: "Thử lại", empty: "Catalog đang được cập nhật theo từng đợt." }
    : { eyebrow: "Planned menu", title: "Dishes the kitchen is refining", description: "The kitchen is refining these dishes in batches.", price: "Planned price", view: "View dish", all: "View the full planned menu", retry: "Try again", empty: "The catalog is being updated in batches." };

  return (
    <section id="meals" className="botanical-section botanical-soft py-16 md:py-24">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
          <Link href={`/${locale}/menu`} className="min-h-11 self-start text-sm font-bold text-olive-900 underline decoration-olive-500/50 underline-offset-4 hover:decoration-olive-900 md:self-auto">
            {copy.all}
          </Link>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-lg bg-beige-200/70" />) : null}
          {error ? (
            <div className="col-span-full flex flex-wrap items-center gap-4 rounded-lg border border-olive-700/10 bg-white p-6 text-muted">
              <p>{copy.empty}</p>
              <button type="button" onClick={retry} className="min-h-11 text-sm font-bold text-olive-900 underline underline-offset-4">{copy.retry}</button>
            </div>
          ) : null}
          {!loading && !error && !data?.items.length ? <p className="col-span-full text-muted">{copy.empty}</p> : null}
          {data?.items.slice(0, 4).map((product) => {
            const presentation = getProductPresentation(product.slug, locale);
            return <article key={product.slug} className="flex min-h-80 flex-col overflow-hidden rounded-lg border border-olive-700/10 bg-white shadow-soft">
              <div className="relative aspect-[4/3] bg-olive-700/10">
                <Image src={presentation.image} alt={presentation.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-wood-500">{copy.price}</p>
                <p className="mt-1 text-sm font-bold text-wood-500">{formatPrice(product.unitPrice, product.currency, locale)}</p>
                <h3 className="mt-3 line-clamp-2 font-serif text-2xl leading-tight text-olive-900">{product.name}</h3>
                {product.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{product.description}</p> : null}
                <Link href={`/${locale}/menu/${encodeURIComponent(product.slug)}`} className="mt-auto pt-5 text-sm font-bold text-olive-900 underline decoration-olive-500/50 underline-offset-4 hover:decoration-olive-900">{copy.view}</Link>
              </div>
            </article>;
          })}
        </div>
      </Container>
    </section>
  );
}
