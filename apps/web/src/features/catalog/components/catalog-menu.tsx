"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/layout/container";
import { orderingEnabled } from "@/lib/ordering";
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
        <h1 className="mt-2 font-serif text-4xl text-olive-900 md:text-5xl">{orderingEnabled ? copy.title : (locale === "vi" ? "Thực đơn dự kiến" : "Planned menu")}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{orderingEnabled ? copy.description : (locale === "vi" ? "Các món đang được bếp hoàn thiện theo từng đợt. Giá và khả năng phục vụ sẽ được xác nhận khi mở bán." : "The kitchen is finalizing these meals in batches. Prices and availability will be confirmed when orders open.")}</p>
        {!orderingEnabled ? <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-y border-olive-700/15 bg-white/70 px-4 py-4"><p className="text-sm font-semibold text-olive-900">{locale === "vi" ? "Bếp chưa mở nhận đơn. Đăng ký để nhận catalog và ngày mở bán chính thức." : "Orders are not open yet. Sign up to receive the official catalog and opening date."}</p><Link href={`/${locale}#waitlist`} className="inline-flex min-h-11 items-center text-sm font-bold text-olive-900 underline decoration-olive-500/50 underline-offset-4">{locale === "vi" ? "Báo tôi khi mở bán" : "Notify me when orders open"}</Link></div> : null}
        {loading ? <CatalogSkeleton label={locale === "vi" ? "Đang tải thực đơn" : "Loading menu"} /> : null}
        {error ? <StateMessage message={copy.error} retry={retry} label={copy.retry} /> : null}
        {data && data.items.length === 0 ? <p className="mt-10 text-sm font-semibold text-muted">{copy.empty}</p> : null}
        {data?.items.length ? <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((product, index) => <CatalogProductCard key={product.slug} product={product} locale={locale} eager={index === 0} />)}</div> : null}
        {data && data.total > data.pageSize ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} previousLabel={locale === "vi" ? "Trang trước" : "Previous"} nextLabel={locale === "vi" ? "Trang sau" : "Next"} /> : null}
      </Container>
    </main>
  );
}

function CatalogSkeleton({ label }: { label: string }) {
  return <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label={label} aria-busy="true">{Array.from({ length: 3 }, (_, index) => <div key={index} className="overflow-hidden rounded-lg border border-olive-700/10 bg-white shadow-soft"><div className="aspect-[4/3] animate-pulse bg-beige-200" /><div className="space-y-3 p-5"><div className="h-4 w-24 animate-pulse bg-beige-200" /><div className="h-7 w-3/4 animate-pulse bg-beige-200" /><div className="h-4 w-full animate-pulse bg-beige-200" /></div></div>)}</div>;
}

function Pagination({ page, pageSize, total, onPageChange, previousLabel, nextLabel }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; previousLabel: string; nextLabel: string }) {
  const pageCount = Math.ceil(total / pageSize);
  return <nav className="mt-10 flex items-center justify-between gap-4 border-t border-olive-700/10 pt-6" aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-full border border-olive-700/25 px-4 py-2 text-sm font-bold text-olive-900 disabled:cursor-not-allowed disabled:opacity-40">{previousLabel}</button><p className="text-sm font-semibold text-muted">{page} / {pageCount}</p><button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="rounded-full border border-olive-700/25 px-4 py-2 text-sm font-bold text-olive-900 disabled:cursor-not-allowed disabled:opacity-40">{nextLabel}</button></nav>;
}

export function StateMessage({ message, retry, label }: { message: string; retry: () => void; label: string }) {
  return <div className="mt-10 flex flex-wrap items-center gap-4 rounded-lg border border-wood-500/20 bg-white/80 p-5"><p className="text-sm font-semibold text-muted">{message}</p><button type="button" onClick={retry} className="rounded-full border border-olive-700/25 px-4 py-2 text-sm font-bold text-olive-900 hover:bg-olive-700/10">{label}</button></div>;
}
