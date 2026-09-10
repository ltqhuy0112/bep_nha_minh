"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/layout/container";
import { copyFor } from "../copy";
import { useCatalogProducts } from "../hooks/use-catalog";
import type { CatalogLocale } from "../types";
import { CatalogProductCard } from "./catalog-product-card";

export function CatalogMenu({ locale }: { locale: CatalogLocale }) {
  const copy = copyFor(locale);
  const [page, setPage] = useState(1);
  const { data, loading, error, retry } = useCatalogProducts(locale, page);
  return (
    <main className="botanical-section botanical-soft min-h-[calc(100vh-10rem)] py-14 md:py-20">
      <Container>
        <Link href={`/${locale}`} className="text-sm font-bold text-olive-900 underline decoration-olive-500/50 underline-offset-4">{copy.backHome}</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-wood-500">{copy.eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl text-olive-900 md:text-5xl">{copy.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{copy.description}</p>
        {loading ? <p className="mt-10 text-sm font-semibold text-muted">{copy.loading}</p> : null}
        {error ? <StateMessage message={copy.error} retry={retry} label={copy.retry} /> : null}
        {data && data.items.length === 0 ? <p className="mt-10 text-sm font-semibold text-muted">{copy.empty}</p> : null}
        {data?.items.length ? <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((product, index) => <CatalogProductCard key={product.slug} product={product} locale={locale} eager={index === 0} />)}</div> : null}
        {data && data.total > data.pageSize ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} previousLabel={locale === "vi" ? "Trang trước" : "Previous"} nextLabel={locale === "vi" ? "Trang sau" : "Next"} /> : null}
      </Container>
    </main>
  );
}

function Pagination({ page, pageSize, total, onPageChange, previousLabel, nextLabel }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; previousLabel: string; nextLabel: string }) {
  const pageCount = Math.ceil(total / pageSize);
  return <nav className="mt-10 flex items-center justify-between gap-4 border-t border-olive-700/10 pt-6" aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-full border border-olive-700/25 px-4 py-2 text-sm font-bold text-olive-900 disabled:cursor-not-allowed disabled:opacity-40">{previousLabel}</button><p className="text-sm font-semibold text-muted">{page} / {pageCount}</p><button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="rounded-full border border-olive-700/25 px-4 py-2 text-sm font-bold text-olive-900 disabled:cursor-not-allowed disabled:opacity-40">{nextLabel}</button></nav>;
}

export function StateMessage({ message, retry, label }: { message: string; retry: () => void; label: string }) {
  return <div className="mt-10 flex flex-wrap items-center gap-4 rounded-lg border border-wood-500/20 bg-white/80 p-5"><p className="text-sm font-semibold text-muted">{message}</p><button type="button" onClick={retry} className="rounded-full border border-olive-700/25 px-4 py-2 text-sm font-bold text-olive-900 hover:bg-olive-700/10">{label}</button></div>;
}
