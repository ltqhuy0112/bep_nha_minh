import type { Locale } from "@bep-nha-minh/shared/constants/i18n";
import type { SiteContent } from "@bep-nha-minh/shared/types/site";

const socialLinks = [
  {
    label: "Instagram",
    href: "https://instagram.com/bepnhaminh.sg/"
  },
  {
    label: "Facebook",
    href: "https://facebook.com/profile.php?id=61591894748199"
  }
];

const defaultSiteContents: Record<Locale, SiteContent> = {
  vi: {
    locale: "vi",
    nav: [
      { label: "Trang chủ", href: "#home" },
      { label: "Câu chuyện", href: "#story" },
      { label: "Quy trình", href: "#workflow" },
      { label: "Liên hệ", href: "#contact" }
    ],
    header: {
      brandAriaLabel: "Bếp Nhà Mình về đầu trang",
      tagline: "Healthy food làm mới theo đơn",
      waitlistCta: "Nhận thông báo",
      menuAriaLabel: "Mở menu",
      desktopNavAriaLabel: "Điều hướng chính",
      mobileNavAriaLabel: "Điều hướng di động",
      languageLabel: "Ngôn ngữ"
    },
    hero: {
      eyebrow: "BẾP NHÀ MÌNH · HEALTHY FOOD TP.HCM",
      headline: "Bếp Nhà Mình",
      supportingText:
        "Bếp chuẩn bị từng phần ăn theo đơn, cân bằng rau, đạm và tinh bột để bạn ăn gọn mà vẫn đủ chất.",
      primaryCta: "Xem thực đơn dự kiến",
      secondaryCta: "Nhận thông báo mở bán",
      image:
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85",
      alt: "Ảnh minh họa phần ăn lành mạnh",
      floatingLabel: "Nấu mới trong ngày",
      preorderCardTitle: "Bếp đang chuẩn bị mở bán",
      preorderCardText: "Để lại thông tin để nhận ngày mở bán và catalog mới nhất."
    },
    sectionHeadings: {
      values: {
        eyebrow: "Giá trị của bếp",
        title: "Nhỏ gọn, tươi mới và vừa đủ cho nhịp sống bận rộn."
      },
      dishes: {
        eyebrow: "Món sắp thử nghiệm",
        title: "Một vài ý tưởng bữa ăn đang được bếp hoàn thiện.",
        description: "Các món dưới đây là preview nội dung, chưa phải menu đặt hàng.",
        badge: "Không có giỏ hàng hoặc checkout"
      },
      workflow: {
        eyebrow: "Quy trình pre-order",
        title: "Từ xem món đến nhận lịch mở bán.",
        description:
          "Bếp liên hệ khi bắt đầu nhận đơn."
      },
      kitchen: {
        eyebrow: "Một ngày trong bếp",
        title: "Từ nguyên liệu đến hộp cơm, mọi thứ được giữ ở quy mô vừa phải."
      }
    },
    values: [
      {
        title: "Tươi mới mỗi ngày",
        description: "Chuẩn bị theo mẻ nhỏ để món ăn giữ được độ ngon tự nhiên.",
        icon: "leaf"
      },
      {
        title: "Làm theo đơn",
        description: "Bếp nhận trước số lượng để nấu vừa đủ và chăm chút hơn.",
        icon: "bowl"
      },
      {
        title: "Hạn chế lãng phí",
        description: "Pre-order giúp nguyên liệu được dùng đúng nhu cầu.",
        icon: "cycle"
      },
      {
        title: "Tiện cho người bận rộn",
        description: "Gợi ý bữa ăn gọn nhẹ cho ngày làm việc cần nhiều năng lượng.",
        icon: "clock"
      }
    ],
    story: {
      eyebrow: "Câu chuyện căn bếp",
      title: "Một căn bếp nhỏ, nấu theo đơn tại TP.HCM.",
      body: [
        "Bếp Nhà Mình là một căn bếp nhỏ tại TP.HCM, nấu từng phần ăn theo đơn để giữ độ tươi.",
        "Chuẩn bị theo số lượng dự kiến giúp bếp chăm chút từng phần và hạn chế lãng phí nguyên liệu."
      ],
      note: "Bếp đang cập nhật menu theo từng đợt trước ngày mở bán."
    },
    dishes: [
      {
        name: "Cơm gà ức nướng sốt tiêu chanh",
        description: "Ức gà nướng mềm, rau củ theo mùa và phần sốt chua nhẹ.",
        tag: "Preview",
        image:
          "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
        alt: "Phần ăn healthy với rau xanh và protein"
      },
      {
        name: "Cơm bò xào rau củ",
        description: "Bò xào nhanh với rau củ giòn, dùng cùng cơm vừa khẩu phần.",
        tag: "Preview",
        image:
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85",
        alt: "Đĩa thức ăn với thịt và rau củ nhiều màu"
      },
      {
        name: "Salad ức gà trứng",
        description: "Rau tươi, trứng luộc, gà áp chảo và sốt nhẹ dễ ăn.",
        tag: "Preview",
        image:
          "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85",
        alt: "Tô salad rau củ tươi nhiều màu"
      },
      {
        name: "Cơm cá hồi áp chảo",
        description: "Cá hồi áp chảo, rau củ xanh và tinh bột vừa đủ.",
        tag: "Preview",
        image:
          "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=85",
        alt: "Phần cá hồi áp chảo ăn cùng rau xanh"
      }
    ],
    workflow: [
      {
        step: "01",
        title: "Chọn món dự kiến",
        description: "Xem catalog món bếp đang hoàn thiện."
      },
      {
        step: "02",
        title: "Đăng ký nhận lịch mở bán",
        description: "Để lại số điện thoại để nhận catalog mới nhất."
      },
      {
        step: "03",
        title: "Bếp liên hệ khi bắt đầu nhận đơn",
        description: "Bếp xác nhận ngày mở bán và khung giao tại TP.HCM."
      }
    ],
    kitchen: [
      {
        title: "Chọn nguyên liệu",
        description: "Ưu tiên rau củ tươi, khẩu phần vừa đủ và cách nêm nhẹ.",
        image:
          "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85",
        alt: "Rau củ tươi được bày trong khu chợ"
      },
      {
        title: "Nấu theo mẻ nhỏ",
        description: "Mỗi đợt nấu được giữ nhỏ để bếp kiểm soát chất lượng.",
        image:
          "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85",
        alt: "Người đang chuẩn bị thức ăn trong bếp"
      },
      {
        title: "Đóng gói gọn nhẹ",
        description: "Phần ăn được sắp xếp sạch sẽ, dễ mang theo trong ngày.",
        image:
          "https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=900&q=85",
        alt: "Các hộp thức ăn healthy được chuẩn bị sẵn"
      }
    ],
    waitlist: {
      eyebrow: "Waitlist",
      title: "Nhận thông báo khi bếp mở bán",
      description:
        "Để lại số điện thoại để nhận ngày mở bán và catalog mới nhất.",
      successMessage:
        "Bếp đã nhận được thông tin của bạn. Khi menu mở bán, Bếp Nhà Mình sẽ gửi thông báo sớm nhất.",
      note:
        "Số điện thoại giúp bếp gửi thông báo nhanh. Email là tùy chọn.",
      form: {
        name: "Tên",
        district: "Khu vực/quận",
        phone: "Số điện thoại",
        email: "Email (không bắt buộc)",
        preferredMeal: "Bữa ăn quan tâm",
        submit: "Nhận thông báo mở bán",
        loading: "Đang kiểm tra...",
        genericError: "Vui lòng kiểm tra lại thông tin hoặc thử lại sau.",
        unsafeHtmlError: "Vui lòng không nhập HTML hoặc ký tự không phù hợp.",
        phoneHintPrefix: "Chuẩn hóa",
        options: ["Bữa trưa", "Bữa tối", "Combo nhiều ngày", "Chưa xác định"]
      }
    },
    social: {
      title: "Liên hệ với Bếp Nhà Mình",
      description:
        "Hotline 091 544 2787 · TP.HCM · Nhận đơn 08:30–16:30.",
      links: socialLinks
    },
    footer: {
      description:
        "Bếp Nhà Mình · Healthy food làm mới theo đơn. TP.HCM · Hotline 091 544 2787 · Nhận đơn 08:30–16:30."
    }
  },
  en: {
    locale: "en",
    nav: [
      { label: "Home", href: "#home" },
      { label: "Story", href: "#story" },
      { label: "Workflow", href: "#workflow" },
      { label: "Contact", href: "#contact" }
    ],
    header: {
      brandAriaLabel: "Back to Bếp Nhà Mình home",
      tagline: "Fresh healthy meals by pre-order",
      waitlistCta: "Join waitlist",
      menuAriaLabel: "Open menu",
      desktopNavAriaLabel: "Primary navigation",
      mobileNavAriaLabel: "Mobile navigation",
      languageLabel: "Language"
    },
    hero: {
      eyebrow: "BẾP NHÀ MÌNH · HEALTHY FOOD HCMC",
      headline: "Bếp Nhà Mình",
      supportingText:
        "The kitchen prepares each made-to-order meal with vegetables, protein, and carbs for a simple, balanced meal.",
      primaryCta: "View planned menu",
      secondaryCta: "Get launch updates",
      image:
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85",
      alt: "Illustrative healthy meal image",
      floatingLabel: "Cooked fresh daily",
      preorderCardTitle: "The kitchen is preparing to launch",
      preorderCardText: "Leave your details for the launch date and latest catalog."
    },
    sectionHeadings: {
      values: {
        eyebrow: "Kitchen values",
        title: "Small-batch, fresh, and practical for busy days."
      },
      dishes: {
        eyebrow: "Meal previews",
        title: "A few meal ideas currently being refined.",
        description: "These are preview items, not a live ordering menu.",
        badge: "No cart or checkout"
      },
      workflow: {
        eyebrow: "Pre-order workflow",
        title: "From viewing dishes to receiving launch news.",
        description:
          "The kitchen will contact you when ordering begins."
      },
      kitchen: {
        eyebrow: "A day in the kitchen",
        title: "From ingredients to meal boxes, everything stays intentionally small."
      }
    },
    values: [
      {
        title: "Fresh every day",
        description: "Meals are prepared in small batches to keep natural flavor and texture.",
        icon: "leaf"
      },
      {
        title: "Made by pre-order",
        description: "The kitchen confirms demand first, then cooks just enough with more care.",
        icon: "bowl"
      },
      {
        title: "Less waste",
        description: "Pre-ordering helps ingredients match real demand.",
        icon: "cycle"
      },
      {
        title: "Built for busy people",
        description: "Simple meal ideas for workdays that need steady energy.",
        icon: "clock"
      }
    ],
    story: {
      eyebrow: "Kitchen story",
      title: "A small made-to-order kitchen in Ho Chi Minh City.",
      body: [
        "Bếp Nhà Mình is a small kitchen in Ho Chi Minh City that prepares meals to order to keep them fresh.",
        "Planning each batch around expected demand gives the kitchen room to care for every meal and reduce ingredient waste."
      ],
      note: "The menu is being updated in batches before launch."
    },
    dishes: [
      {
        name: "Grilled chicken rice with lemon pepper sauce",
        description: "Tender grilled chicken breast, seasonal vegetables, and a light tangy sauce.",
        tag: "Preview",
        image:
          "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
        alt: "Healthy meal with greens and protein"
      },
      {
        name: "Stir-fried beef and vegetable rice",
        description: "Quick stir-fried beef with crisp vegetables and a balanced rice portion.",
        tag: "Preview",
        image:
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85",
        alt: "Plate of food with meat and colorful vegetables"
      },
      {
        name: "Chicken and egg salad",
        description: "Fresh greens, boiled egg, seared chicken, and a light dressing.",
        tag: "Preview",
        image:
          "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85",
        alt: "Colorful fresh vegetable salad bowl"
      },
      {
        name: "Pan-seared salmon rice",
        description: "Pan-seared salmon, green vegetables, and a practical portion of carbs.",
        tag: "Preview",
        image:
          "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=85",
        alt: "Pan-seared salmon served with greens"
      }
    ],
    workflow: [
      {
        step: "01",
        title: "View planned dishes",
        description: "Browse the catalog the kitchen is refining."
      },
      {
        step: "02",
        title: "Sign up for launch news",
        description: "Leave your phone number for the latest catalog."
      },
      {
        step: "03",
        title: "The kitchen contacts you",
        description: "We will confirm the launch date and HCMC delivery windows."
      }
    ],
    kitchen: [
      {
        title: "Choose ingredients",
        description: "Fresh vegetables, balanced portions, and gentle seasoning come first.",
        image:
          "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85",
        alt: "Fresh vegetables displayed at a market"
      },
      {
        title: "Cook in small batches",
        description: "Each batch stays small so quality is easier to control.",
        image:
          "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85",
        alt: "Person preparing food in a kitchen"
      },
      {
        title: "Pack neatly",
        description: "Meals are arranged cleanly and made easy to carry through the day.",
        image:
          "https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=900&q=85",
        alt: "Prepared healthy meal boxes"
      }
    ],
    waitlist: {
      eyebrow: "Waitlist",
      title: "Get notified when the kitchen opens",
      description:
        "Leave your phone number for the launch date and latest catalog.",
      successMessage:
        "Your details have been received. Bếp Nhà Mình will send an early update when the menu opens.",
      note:
        "A phone number is the quickest way to send launch news. Email is optional.",
      form: {
        name: "Name",
        district: "Area/district",
        phone: "Phone",
        email: "Email (optional)",
        preferredMeal: "Preferred meal",
        submit: "Get launch updates",
        loading: "Checking...",
        genericError: "Please check your information or try again later.",
        unsafeHtmlError: "Please do not enter HTML or unsafe characters.",
        phoneHintPrefix: "Normalized",
        options: ["Lunch", "Dinner", "Multi-day combo", "Not sure yet"]
      }
    },
    social: {
      title: "Contact Bếp Nhà Mình",
      description:
        "Hotline 091 544 2787 · Ho Chi Minh City · Order hours 08:30–16:30.",
      links: socialLinks
    },
    footer: {
      description:
        "Bếp Nhà Mình · Healthy food made fresh to order. Ho Chi Minh City · Hotline 091 544 2787 · Order hours 08:30–16:30."
    }
  }
};

export function createSiteContents(overrides: { instagramUrl?: string; facebookUrl?: string } = {}): Record<Locale, SiteContent> {
  const contents = structuredClone(defaultSiteContents);
  for (const locale of ["vi", "en"] as const) {
    contents[locale].social.links = socialLinks.map((link) => ({
      ...link,
      href: (link.label === "Instagram" ? overrides.instagramUrl : overrides.facebookUrl) || link.href
    }));
  }
  return contents;
}
