import { logoPath } from "@/lib/site";
import type { Locale } from "@bep-nha-minh/shared/constants/i18n";

type ProductPresentation = { image: string; alt: Record<Locale, string> };

const productPresentation: Record<string, ProductPresentation> = {
  "grilled-chicken-rice": {
    image: logoPath,
    alt: { vi: "Phần ăn healthy với rau xanh và protein", en: "Healthy meal with greens and protein" }
  },
  "beef-vegetable-rice": {
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85",
    alt: { vi: "Đĩa thức ăn với thịt và rau củ nhiều màu", en: "Plate of food with meat and colorful vegetables" }
  },
  "chicken-egg-salad": {
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85",
    alt: { vi: "Tô salad rau củ tươi nhiều màu", en: "Colorful fresh vegetable salad bowl" }
  },
  "salmon-rice": {
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=85",
    alt: { vi: "Phần cá hồi áp chảo ăn cùng rau xanh", en: "Pan-seared salmon served with greens" }
  }
};

export function getProductPresentation(slug: string, locale: Locale) {
  const presentation = productPresentation[slug];
  return presentation
    ? { image: presentation.image, alt: presentation.alt[locale] }
    : { image: logoPath, alt: "Bếp Nhà Mình" };
}
