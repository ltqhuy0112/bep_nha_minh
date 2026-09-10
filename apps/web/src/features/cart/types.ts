import type { CartItem as SharedCartItem } from "@bep-nha-minh/shared/types/cart";
import type { Locale } from "@bep-nha-minh/shared/constants/i18n";

export type CartLocale = Locale;
export type CartItem = SharedCartItem;
export type CartSlot = { slotKey: string; label: string; startLocalTime: string; endLocalTime: string; cutoffPassed: boolean };
