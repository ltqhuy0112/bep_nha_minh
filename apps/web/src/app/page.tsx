import { redirect } from "next/navigation";
import { defaultLocale } from "@bep-nha-minh/shared/constants/i18n";

export default function Home() {
  redirect(`/${defaultLocale}`);
}
