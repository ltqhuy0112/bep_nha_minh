import type { CartLocale, CartSlot } from "./types";

export function formatSlotTime(value: string) {
  const [hour = "", minute = ""] = value.split(":");
  return hour && minute ? `${hour}:${minute}` : value;
}

export function formatDeliverySlot(slot: Pick<CartSlot, "label" | "startLocalTime" | "endLocalTime">, locale: CartLocale) {
  const value = `${formatSlotTime(slot.startLocalTime)}–${formatSlotTime(slot.endLocalTime)}`;
  return { label: /^[A-Z0-9_]+$/.test(slot.label) ? (locale === "vi" ? `Khung giờ ${value}` : `Delivery ${value}`) : slot.label, time: value };
}
