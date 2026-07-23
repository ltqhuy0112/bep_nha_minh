import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteContents } from "@/data/site-content";
import { defaultLocale, isLocale, locales, type Locale } from "@/lib/i18n";
import { brandName, siteUrl } from "@/lib/site";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { HeroSection } from "@/components/sections/hero-section";
import { BrandValues } from "@/components/sections/brand-values";
import { StorySection } from "@/components/sections/story-section";
import { DishGrid } from "@/components/sections/dish-grid";
import { PreorderWorkflow } from "@/components/sections/preorder-workflow";
import { KitchenGallery } from "@/components/sections/kitchen-gallery";
import { WaitlistSection } from "@/components/sections/waitlist-section";
import { SocialSection } from "@/components/sections/social-section";

type LocaleParams = Promise<{ locale: string }>;

const metadataByLocale: Record<
  Locale,
  {
    title: string;
    description: string;
    ogLocale: string;
    jsonLdDescription: string;
    ogAlt: string;
  }
> = {
  vi: {
    title: "Bếp Nhà Mình | Healthy Food Làm Mới Theo Đơn",
    description:
      "Bếp Nhà Mình là căn bếp healthy nhỏ, phục vụ các bữa ăn tươi mới theo hình thức pre-order dành cho người bận rộn.",
    ogLocale: "vi_VN",
    jsonLdDescription:
      "Căn bếp healthy nhỏ phục vụ các bữa ăn làm mới theo hình thức pre-order. Địa chỉ, số điện thoại và giờ mở bán sẽ được cập nhật khi có thông tin chính thức.",
    ogAlt: "Bếp Nhà Mình healthy food làm mới theo đơn"
  },
  en: {
    title: "Bếp Nhà Mình | Fresh Healthy Meals by Pre-order",
    description:
      "Bếp Nhà Mình is a small healthy kitchen serving fresh pre-order meals for busy people.",
    ogLocale: "en_US",
    jsonLdDescription:
      "A small healthy kitchen serving fresh pre-order meals. Address, phone number, and opening hours will be updated when official information is available.",
    ogAlt: "Bếp Nhà Mình fresh healthy meals by pre-order"
  }
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: LocaleParams;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) {
    return {};
  }

  const metadata = metadataByLocale[rawLocale];

  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: `/${rawLocale}`,
      languages: {
        vi: "/vi",
        en: "/en",
        "x-default": `/${defaultLocale}`
      }
    },
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      url: `/${rawLocale}`,
      siteName: brandName,
      locale: metadata.ogLocale,
      type: "website",
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: metadata.ogAlt
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description
    }
  };
}

export default async function LocalizedHome({
  params
}: {
  params: LocaleParams;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) {
    notFound();
  }

  const content = siteContents[rawLocale];
  const metadata = metadataByLocale[rawLocale];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FoodService",
    name: brandName,
    url: `${siteUrl}/${rawLocale}`,
    description: metadata.jsonLdDescription,
    servesCuisine: ["Vietnamese", "Healthy food"],
    sameAs: content.social.links.map((link) => link.href)
  };

  return (
    <>
      <HtmlLangSync locale={rawLocale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header nav={content.nav} locale={rawLocale} labels={content.header} />
      <main>
        <HeroSection hero={content.hero} />
        <BrandValues
          heading={content.sectionHeadings.values}
          values={content.values}
        />
        <StorySection story={content.story} />
        <DishGrid
          dishes={content.dishes}
          heading={content.sectionHeadings.dishes}
        />
        <PreorderWorkflow
          workflow={content.workflow}
          heading={content.sectionHeadings.workflow}
        />
        <KitchenGallery
          heading={content.sectionHeadings.kitchen}
          items={content.kitchen}
        />
        <WaitlistSection waitlist={content.waitlist} />
        <SocialSection social={content.social} />
      </main>
      <Footer description={content.footer.description} links={content.social.links} />
    </>
  );
}
