import Image from "next/image";
import Link from "next/link";
import { copyFor } from "../copy";
import { formatPrice, getProductPresentation } from "../presentation";
import type { CatalogLocale, CatalogProduct } from "../types";

export function CatalogProductCard({ product, locale, eager = false }: { product: CatalogProduct; locale: CatalogLocale; eager?: boolean }) {
  const copy = copyFor(locale);
  const presentation = getProductPresentation(product.slug, locale);
  return (
    <article className="group overflow-hidden rounded-lg border border-olive-700/10 bg-white shadow-soft">
      <div className="relative aspect-[4/3] overflow-hidden bg-beige-200">
        <Image src={presentation.image} alt={presentation.alt} fill loading={eager ? "eager" : "lazy"} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
      </div>
      <div className="flex min-h-56 flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-wood-500">{formatPrice(product.unitPrice, product.currency, locale)}</p>
          {!product.acceptingOrders ? <span className="rounded-full bg-wood-500/15 px-3 py-1 text-xs font-bold text-wood-500">{copy.paused}</span> : null}
        </div>
        <h2 className="mt-3 font-serif text-2xl leading-tight text-olive-900">{product.name}</h2>
        {product.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{product.description}</p> : null}
        {product.fulfillmentBlocked ? <p className="mt-3 text-sm font-semibold text-wood-500">{copy.blocked}</p> : null}
        <Link href={`/${locale}/menu/${encodeURIComponent(product.slug)}`} className="mt-auto pt-5 text-sm font-bold text-olive-900 underline decoration-olive-500/50 underline-offset-4 hover:decoration-olive-900">
          {copy.viewDetails}
        </Link>
      </div>
    </article>
  );
}
