"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, MapPin, Pencil, Plus, RotateCw, Trash2, X } from "lucide-react";
import type { CustomerAddress } from "@bep-nha-minh/shared/schemas/customer-address";
import type { Locale } from "@bep-nha-minh/shared/constants/i18n";
import { AddressForm } from "./address-form";
import { defaultAddress, deleteAddress, saveAddress } from "./service";
import { useAddresses } from "./use-addresses";

export function AddressesClient({ locale }: { locale: Locale }) {
  const state = useAddresses(locale);
  const { text } = state;
  const [editing, setEditing] = useState<CustomerAddress | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CustomerAddress | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (deleting) dialog.current?.showModal(); else dialog.current?.close(); }, [deleting]);
  const disabled = state.busy || state.loading;
  return <main className="min-h-dvh bg-[#f3f6f0] text-olive-900">
    <header className="border-b border-olive-700/15 bg-white px-5 py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <Link href={`/${locale}/account`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft size={18} />{text.account}</Link>
        <Link href={`/${locale}`} className="flex items-center gap-3"><Image src="/brand-logo.jpg" width={40} height={40} className="rounded-full" alt="" /><span className="font-serif text-xl font-semibold">Bếp Nhà Mình</span></Link>
      </div>
    </header>
    <div className="mx-auto max-w-4xl px-5 py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold">{text.title}</h1>
        <button type="button" disabled={disabled || editing !== undefined} onClick={() => setEditing(null)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-olive-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus size={18} />{text.add}</button>
      </div>
      {state.error ? <div className="mb-5 flex flex-wrap items-center gap-3"><p role="alert" className="text-sm text-red-800">{state.error}</p><button type="button" disabled={disabled} onClick={state.reload} className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold"><RotateCw size={16} />{text.retry}</button></div> : null}
      {state.message ? <p className="mb-5 text-sm" role="status">{state.message}</p> : null}
      {editing !== undefined ? <AddressForm key={editing?.id ?? "new"} address={editing} text={text} locale={locale} busy={disabled} onCancel={() => setEditing(undefined)} onSave={async (input) => {
        if (await state.mutate(() => saveAddress(input, editing?.id), text.saved)) setEditing(undefined);
      }} /> : null}
      {state.loading ? <p className="py-10 text-sm" role="status">{text.loading}</p> : null}
      {!state.loading && !state.error && !state.items.length && editing === undefined ? <div className="flex flex-col items-center gap-4 border-y border-olive-700/15 py-16 text-center"><MapPin size={32} strokeWidth={1.5} /><p>{text.empty}</p></div> : null}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-busy={disabled}>
        {state.items.map((address) => <li key={address.id} className="flex min-w-0 flex-col rounded-lg border border-olive-700/15 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="max-w-full break-words text-base font-semibold">{address.recipientName}</h2>{address.isDefault ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-olive-700"><Check size={14} />{text.default}</span> : null}</div>
          <p className="mt-2 text-sm">{address.phone}</p><p className="mt-2 break-words text-sm leading-6 text-muted">{[address.addressLine, locale === "en" ? address.wardNameEn ?? address.ward : address.ward, address.district, locale === "en" ? address.provinceNameEn ?? address.city : address.city].filter(Boolean).join(", ")}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
            {!address.isDefault ? <button type="button" disabled={disabled || editing !== undefined} onClick={() => void state.mutate(() => defaultAddress(address.id), text.updated)} className="min-h-11 text-sm font-semibold underline underline-offset-4 disabled:opacity-50">{text.makeDefault}</button> : <span />}
            <div className="flex gap-1"><button type="button" title={text.edit} aria-label={text.edit} disabled={disabled || editing !== undefined} onClick={() => setEditing(address)} className="flex size-11 items-center justify-center rounded-md border border-olive-700/15 disabled:opacity-50"><Pencil size={17} /></button><button type="button" title={text.remove} aria-label={text.remove} disabled={disabled || editing !== undefined} onClick={() => setDeleting(address)} className="flex size-11 items-center justify-center rounded-md border border-olive-700/15 text-red-800 disabled:opacity-50"><Trash2 size={17} /></button></div>
          </div>
        </li>)}
      </ul>
    </div>
    <dialog ref={dialog} aria-labelledby="delete-address-title" onCancel={(event) => { if (state.busy) event.preventDefault(); else setDeleting(null); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-lg border border-olive-700/20 bg-white p-6 text-olive-900 shadow-xl backdrop:bg-black/35">
      <h2 id="delete-address-title" className="font-serif text-2xl font-semibold">{text.confirm}</h2>
      <p className="mt-3 break-words text-sm font-semibold">{deleting?.recipientName}</p><p className="mt-3 text-sm text-muted">{text.deleteNote}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={state.busy} autoFocus onClick={() => setDeleting(null)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-olive-700/20 px-4 text-sm"><X size={16} />{text.cancel}</button><button type="button" disabled={state.busy} onClick={async () => { if (deleting && await state.mutate(() => deleteAddress(deleting.id), text.deleted)) setDeleting(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-red-800 px-4 text-sm text-white disabled:opacity-50"><Trash2 size={16} />{text.remove}</button></div>
      {state.error ? <p className="mt-4 text-sm text-red-800" role="alert">{state.error}</p> : null}
    </dialog>
  </main>;
}
