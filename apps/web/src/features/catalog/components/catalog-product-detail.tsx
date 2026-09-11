"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Container } from "@/components/layout/container";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { orderingEnabled } from "@/lib/ordering";
import { copyFor } from "../copy";
import { useAvailability, useCatalogProduct, useFulfillmentSlots } from "../hooks/use-catalog";
import { formatPrice, getProductPresentation } from "../presentation";
import type { CatalogLocale, ProductAvailability } from "../types";
import { StateMessage } from "./catalog-menu";

export function CatalogProductDetail({ locale, slug }: { locale: CatalogLocale; slug: string }) {
  const copy = copyFor(locale);
  const { data: product, loading: productLoading, error: productError, retry: retryProduct } = useCatalogProduct(slug, locale);
  const currentBusinessDate = useBusinessDate();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? currentBusinessDate;
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const slots = useFulfillmentSlots(date, orderingEnabled);
  const availability = useAvailability(slug, locale, date, slotKey, orderingEnabled);

  if (productLoading) return <CatalogState locale={locale} message={copy.loading} />;
  if (productError?.status === 404) return <CatalogState locale={locale} message={copy.notFound} />;
  if (productError || !product) return <CatalogState locale={locale} message={copy.detailError} retry={retryProduct} />;

  const presentation = getProductPresentation(product.slug, locale);
  const photoPending = product.slug === "grilled-chicken-rice";
  return (
    <main className="botanical-section botanical-soft min-h-[calc(100vh-10rem)] py-14 md:py-20">
      <Container>
        <Link href={`/${locale}/menu`} className="text-sm font-bold text-olive-900 underline decoration-olive-500/50 underline-offset-4">{copy.detailBack}</Link>
        <div className="mt-8 grid gap-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:items-start">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-beige-200 shadow-soft">
            <Image src={presentation.image} alt={photoPending ? (locale === "vi" ? "Ảnh món cơm gà đang được cập nhật" : "Photo for the chicken rice meal is being updated") : presentation.alt} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
            {photoPending ? <span className="absolute inset-x-3 bottom-3 rounded bg-white/90 px-3 py-2 text-center text-xs font-semibold text-olive-900">{locale === "vi" ? "Ảnh món đang cập nhật" : "Meal photo coming soon"}</span> : null}
          </div>
          <section>
            <div className="flex flex-wrap items-center gap-2">
              {!product.acceptingOrders ? <StatusBadge label={copy.paused} /> : null}
              {product.fulfillmentBlocked ? <StatusBadge label={copy.blocked} /> : null}
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-olive-900 md:text-5xl">{product.name}</h1>
            <p className="mt-5 text-sm font-bold text-wood-500">{orderingEnabled ? copy.price : (locale === "vi" ? "Giá dự kiến" : "Planned price")}: {formatPrice(product.unitPrice, product.currency, locale)}</p>
            {product.description ? <p className="mt-5 text-base leading-7 text-muted">{product.description}</p> : null}
            {orderingEnabled ? <><div className="mt-6"><AddToCartButton slug={product.slug} locale={locale} disabled={!product.acceptingOrders || product.fulfillmentBlocked} /></div><Link href={`/${locale}/cart`} className="mt-4 inline-block text-sm font-semibold underline">{locale === "vi" ? "Xem giỏ hàng" : "View cart"}</Link></> : <Link href={`/${locale}#waitlist`} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{locale === "vi" ? "Báo tôi khi mở bán" : "Notify me when orders open"}</Link>}
          </section>
        </div>

        {orderingEnabled ? <section className="mt-14 border-t border-olive-700/10 pt-10">
          <h2 className="font-serif text-3xl text-olive-900">{copy.slotsTitle}</h2>
          {!date ? <p className="mt-5 text-sm font-semibold text-muted">{copy.slotsLoading}</p> : null}
          <div className="mt-6 max-w-xs"><label htmlFor="fulfillment-date" className="mb-2 block text-sm font-bold text-olive-900">{copy.dateLabel}</label><input id="fulfillment-date" type="date" value={date ?? ""} onChange={(event) => { setSelectedDate(event.target.value); setSlotKey(null); }} className="filter-control" /></div>
          {date ? <p className="mt-2 text-xs text-muted">{copy.businessDate}</p> : null}
          {slots.loading ? <p className="mt-7 text-sm font-semibold text-muted">{copy.slotsLoading}</p> : null}
          {slots.error ? <StateMessage message={copy.slotsError} retry={slots.retry} label={copy.retry} /> : null}
          {slots.data?.items.length === 0 ? <p className="mt-7 text-sm font-semibold text-muted">{copy.slotsEmpty}</p> : null}
          {slots.data?.items.length ? <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{slots.data.items.map((slot) => <button key={slot.slotKey} type="button" aria-pressed={slot.slotKey === slotKey} onClick={() => setSlotKey(slot.slotKey)} className={["min-h-24 rounded-lg border p-4 text-left transition", slot.slotKey === slotKey ? "border-olive-700 bg-olive-700 text-cream-100" : "border-olive-700/15 bg-white text-olive-900 hover:border-olive-700/45"].join(" ")}><span className="block text-sm font-bold">{slot.label}</span><span className="mt-2 block text-sm font-semibold">{slot.startLocalTime} - {slot.endLocalTime}</span><span className="mt-2 block text-xs opacity-80">{copy.cutoff}: {formatCutoff(slot.cutoffAt, slot.timezone, locale)}</span>{slot.cutoffPassed ? <span className="mt-2 block text-xs font-bold">{copy.cutoffPassed}</span> : null}</button>)}</div> : null}
          {slotKey ? <AvailabilityPanel availability={availability.data} loading={availability.loading} error={availability.error !== null} retry={availability.retry} locale={locale} /> : null}
        </section> : null}
      </Container>
    </main>
  );
}

function CatalogState({ locale, message, retry }: { locale: CatalogLocale; message: string; retry?: () => void }) {
  const copy = copyFor(locale);
  return <main className="min-h-[calc(100vh-10rem)] py-14 md:py-20"><Container><Link href={`/${locale}/menu`} className="text-sm font-bold text-olive-900 underline decoration-olive-500/50 underline-offset-4">{copy.detailBack}</Link>{retry ? <StateMessage message={message} retry={retry} label={copy.retry} /> : <p className="mt-10 text-sm font-semibold text-muted">{message}</p>}</Container></main>;
}

function AvailabilityPanel({ availability, loading, error, retry, locale }: { availability: ProductAvailability | null; loading: boolean; error: boolean; retry: () => void; locale: CatalogLocale }) {
  const copy = copyFor(locale);
  if (loading) return <p className="mt-7 text-sm font-semibold text-muted">{copy.availabilityLoading}</p>;
  if (error) return <StateMessage message={copy.detailError} retry={retry} label={copy.retry} />;
  if (!availability) return null;
  const label = !availability.acceptingOrders || availability.fulfillmentBlocked ? copy.unavailable : availability.cutoffPassed ? copy.cutoffPassed : !availability.inventoryConfigured ? copy.inventoryNotSet : availability.availableQuantity === 0 ? copy.soldOut : copy.available;
  return <div className="mt-7 rounded-lg border border-olive-700/15 bg-white p-5"><p className="text-lg font-bold text-olive-900">{label}</p>{availability.inventoryConfigured && availability.availableQuantity !== null ? <p className="mt-2 text-sm text-muted">{copy.quantity.replace("{count}", String(availability.availableQuantity))}</p> : <p className="mt-2 text-sm text-muted">{copy.inventoryNotSet}</p>}</div>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-wood-500/15 px-3 py-1 text-xs font-bold text-wood-500">{label}</span>;
}

function businessDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function useBusinessDate() {
  return useSyncExternalStore(
    () => () => undefined,
    businessDate,
    () => null
  );
}

function formatCutoff(cutoffAt: string, timeZone: string, locale: CatalogLocale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(cutoffAt));
}
