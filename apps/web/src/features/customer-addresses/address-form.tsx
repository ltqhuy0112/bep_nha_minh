"use client";

import { useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { customerAddressSchema, type CustomerAddress, type CustomerAddressInput } from "@bep-nha-minh/shared/schemas/customer-address";
import type { AddressCopy } from "./copy";
import { LocationFields } from "./location-fields";

export function AddressForm({ address, text, busy, onSave, onCancel, locale }: {
  address: CustomerAddress | null; text: AddressCopy; busy: boolean;
  onSave: (input: CustomerAddressInput) => Promise<void>; onCancel: () => void;
  locale: "vi" | "en";
}) {
  const [invalid, setInvalid] = useState<string[]>([]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = customerAddressSchema.safeParse({ ...Object.fromEntries(form), isDefault: form.get("isDefault") === "on" });
    if (!parsed.success) { setInvalid(parsed.error.issues.map((issue) => String(issue.path[0]))); return; }
    setInvalid([]);
    void onSave(parsed.data);
  }
  const fields = [
    { name: "recipientName", label: text.name, auto: "name", max: 120, required: true },
    { name: "phone", label: text.phone, auto: "tel", max: 24, required: true },
    { name: "addressLine", label: text.line, auto: "address-line1", max: 500, required: true },
  ] as const;
  return <form onSubmit={submit} className="border-y border-olive-700/15 py-6">
    <h2 className="mb-5 font-serif text-2xl">{address ? text.edit : text.add}</h2>
    {address && !address.provinceCode ? <p className="mb-4 text-sm text-muted">{text.legacyAddress}</p> : null}
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => <label key={field.name} className={`grid gap-2 text-sm font-semibold ${field.name === "addressLine" ? "sm:col-span-2" : ""}`}>
        <span>{field.label}{!field.required ? <span className="ml-1 font-normal text-muted">({text.optional})</span> : null}</span>
        <input name={field.name} defaultValue={address?.[field.name] ?? ""} type={field.name === "phone" ? "tel" : "text"}
          autoComplete={field.auto} maxLength={field.max} required={field.required} aria-invalid={invalid.includes(field.name)}
          className="min-h-11 rounded-md border border-olive-700/25 bg-white px-3 font-normal outline-none focus:border-olive-700 focus:ring-2 focus:ring-olive-700/20 aria-invalid:border-red-700" />
      </label>)}
      <LocationFields initialProvince={address?.provinceCode ?? null} initialWard={address?.wardCode ?? null} locale={locale} text={text} invalid={invalid} />
      <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" name="isDefault" defaultChecked={address?.isDefault ?? false} className="size-4 accent-olive-700" />{text.makeDefault}</label>
    </fieldset>
    {invalid.length ? <p className="mt-3 text-sm text-red-800" role="alert">{text.invalid}</p> : null}
    <div className="mt-5 flex flex-wrap gap-3">
      <button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-olive-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><Check size={18} />{text.save}</button>
      <button type="button" disabled={busy} onClick={onCancel} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-olive-700/20 px-4 text-sm"><X size={18} />{text.cancel}</button>
    </div>
  </form>;
}
