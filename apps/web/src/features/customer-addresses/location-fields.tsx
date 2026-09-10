"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import type { LocationOption } from "@bep-nha-minh/shared/types/locations";
import { loadLocations } from "./locations";
import type { AddressCopy } from "./copy";

export function LocationFields({ initialProvince, initialWard, locale, text, invalid }: {
  initialProvince: string | null; initialWard: string | null; locale: "vi" | "en"; text: AddressCopy; invalid: string[];
}) {
  const [province, setProvince] = useState(initialProvince ?? "");
  const [ward, setWard] = useState(initialWard ?? "");
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const [provinceLoading, setProvinceLoading] = useState(true);
  const [wardLoading, setWardLoading] = useState(Boolean(initialProvince));
  const [provinceError, setProvinceError] = useState(false);
  const [wardError, setWardError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadLocations(undefined, attempt > 0).then((data) => { if (active) setProvinces(data.items); })
      .catch(() => { if (active) setProvinceError(true); })
      .finally(() => { if (active) setProvinceLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (!province) return;
    let active = true;
    void loadLocations(province, attempt > 0).then((data) => { if (active) setWards(data.items); })
      .catch(() => { if (active) setWardError(true); })
      .finally(() => { if (active) setWardLoading(false); });
    return () => { active = false; };
  }, [province, attempt]);
  function retry() {
    setProvinceError(false); setWardError(false); setProvinceLoading(true); setWardLoading(Boolean(province));
    setAttempt((value) => value + 1);
  }
  const provinceValid = provinces.some((item) => item.code === province);
  const wardValid = wards.some((item) => item.code === ward);
  const blocked = provinceLoading || wardLoading || provinceError || wardError;
  const options = (items: LocationOption[]) => items.map((item) => <option key={item.code} value={item.code}>{locale === "en" ? item.nameEn : item.name}</option>);
  return <>
    <label className="grid min-w-0 gap-2 text-sm font-semibold">{text.city}
      <select aria-invalid={invalid.includes("provinceCode")} required name="provinceCode" value={provinceValid ? province : ""} disabled={provinceLoading || provinceError}
        onChange={(event) => { setProvince(event.target.value); setWard(""); setWards([]); setWardError(false); setWardLoading(Boolean(event.target.value)); }} className="filter-control min-w-0">
        <option value="">{provinceLoading ? text.loading : text.chooseProvince}</option>{options(provinces)}
      </select>
    </label>
    <label className="grid min-w-0 gap-2 text-sm font-semibold">{text.ward}
      <select aria-invalid={invalid.includes("wardCode")} required name="wardCode" value={wardValid ? ward : ""} disabled={!provinceValid || blocked}
        onChange={(event) => setWard(event.target.value)} className="filter-control min-w-0">
        <option value="">{wardLoading ? text.loading : text.chooseWard}</option>{options(wards)}
      </select>
    </label>
    {provinceError || wardError ? <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2"><p role="alert" className="text-red-800">{text.locationError}</p><button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 font-semibold"><RotateCw size={16} />{text.retry}</button></div> : null}
  </>;
}
