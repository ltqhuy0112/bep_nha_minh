import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteContents } from "@bep-nha-minh/api/data/site-content";
import {
  defaultLocale,
  isLocale,
  locales,
  type Locale
} from "@bep-nha-minh/shared/constants/i18n";
import {
  absoluteUrl,
  brandName,
  businessAreaServed,
  businessCountry,
  businessCuisine,
  businessEmail,
  businessLocality,
  businessRegion,
  businessTimezone,
  formattedHotline,
  hotline,
  logoPath,
  ogImagePath,
  seoKeywords,
  siteUrl,
  socialProfileUrls
} from "@/lib/site";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { FloatingActions } from "@/components/layout/floating-actions";
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
    keywords: readonly string[];
    ogLocale: string;
    jsonLdDescription: string;
    ogAlt: string;
  }
> = {
  vi: {
    title: "Bếp Nhà Mình | Healthy Food TP.HCM Làm Mới Theo Đơn",
    description:
      "Bếp Nhà Mình là căn bếp healthy nhỏ tại TP.HCM, phục vụ cơm healthy và meal prep làm mới theo đơn cho người bận rộn.",
    keywords: seoKeywords.vi,
    ogLocale: "vi_VN",
    jsonLdDescription:
      "Căn bếp healthy nhỏ tại TP.HCM phục vụ các bữa ăn lành mạnh làm mới theo hình thức pre-order.",
    ogAlt: "Bếp Nhà Mình healthy food làm mới theo đơn"
  },
  en: {
    title: "Bếp Nhà Mình | Healthy Meal Prep in Ho Chi Minh City",
    description:
      "Bếp Nhà Mình is a small healthy kitchen in Ho Chi Minh City serving fresh pre-order meals and healthy meal prep for busy people.",
    keywords: seoKeywords.en,
    ogLocale: "en_US",
    jsonLdDescription:
      "A small healthy kitchen in Ho Chi Minh City serving fresh pre-order meals and healthy meal prep.",
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
    keywords: [...metadata.keywords],
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
          url: absoluteUrl(ogImagePath),
          width: 1200,
          height: 630,
          alt: metadata.ogAlt
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
      images: [absoluteUrl(ogImagePath)]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
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
  const localePath = `/${rawLocale}`;
  const pageUrl = `${siteUrl}${localePath}`;
  const logoUrl = absoluteUrl(logoPath);
  const ogImageUrl = absoluteUrl(ogImagePath);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: brandName,
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: logoUrl
        },
        image: ogImageUrl,
        email: businessEmail,
        telephone: hotline,
        sameAs: socialProfileUrls
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: brandName,
        inLanguage: rawLocale,
        publisher: {
          "@id": `${siteUrl}/#organization`
        }
      },
      {
        "@type": "FoodService",
        "@id": `${siteUrl}/#foodservice`,
        name: brandName,
        url: pageUrl,
        description: metadata.jsonLdDescription,
        image: ogImageUrl,
        logo: logoUrl,
        telephone: formattedHotline,
        email: businessEmail,
        priceRange: "$$",
        currenciesAccepted: "VND",
        paymentAccepted: "Cash, Bank transfer",
        timeZone: businessTimezone,
        servesCuisine: businessCuisine,
        areaServed: businessAreaServed.map((area) => ({
          "@type": "Place",
          name: area
        })),
        address: {
          "@type": "PostalAddress",
          addressLocality: businessLocality,
          addressRegion: businessRegion,
          addressCountry: businessCountry
        },
        openingHoursSpecification: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          opens: "09:00",
          closes: "18:00"
        },
        sameAs: socialProfileUrls,
        parentOrganization: {
          "@id": `${siteUrl}/#organization`
        }
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: metadata.title,
        description: metadata.description,
        isPartOf: {
          "@id": `${siteUrl}/#website`
        },
        about: {
          "@id": `${siteUrl}/#foodservice`
        },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: ogImageUrl,
          width: 1200,
          height: 630
        },
        inLanguage: rawLocale,
        dateModified: "2026-07-23"
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: brandName,
            item: pageUrl
          }
        ]
      }
    ]
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
      <FloatingActions locale={rawLocale} />
    </>
  );
}
