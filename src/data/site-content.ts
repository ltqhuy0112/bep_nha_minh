import type { Locale } from "@/lib/i18n";
import type { SiteContent } from "@/types/site";

const socialLinks = [
  {
    label: "Instagram",
    href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com/"
  },
  {
    label: "Facebook",
    href: process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://facebook.com/"
  },
  {
    label: "TikTok",
    href: process.env.NEXT_PUBLIC_TIKTOK_URL || "https://tiktok.com/"
  }
];

export const siteContents: Record<Locale, SiteContent> = {
  vi: {
    locale: "vi",
    nav: [
      { label: "Trang chủ", href: "#home" },
      { label: "Câu chuyện", href: "#story" },
      { label: "Món ăn", href: "#meals" },
      { label: "Quy trình", href: "#workflow" },
      { label: "Liên hệ", href: "#contact" }
    ],
    header: {
      brandAriaLabel: "Bếp Nhà Mình về đầu trang",
      tagline: "Healthy food làm mới theo đơn",
      waitlistCta: "Ghi danh",
      menuAriaLabel: "Mở menu",
      desktopNavAriaLabel: "Điều hướng chính",
      mobileNavAriaLabel: "Điều hướng di động",
      languageLabel: "Ngôn ngữ"
    },
    hero: {
      eyebrow: "Healthy food làm mới theo đơn",
      headline: "Bữa ăn lành mạnh từ căn bếp nhỏ",
      supportingText:
        "Healthy food làm mới theo đơn, dành cho những ngày bận rộn.",
      primaryCta: "Theo dõi hành trình",
      secondaryCta: "Nhận thông báo mở bán",
      image:
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85",
      alt: "Tô cơm healthy nhiều rau củ, trứng và nguyên liệu tươi",
      floatingLabel: "Nấu mới trong ngày",
      preorderCardTitle: "Pre-order nhỏ gọn",
      preorderCardText: "Không giỏ hàng, không thanh toán online."
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
        title: "Bếp nhận trước, nấu mới và giữ mọi thứ thật đơn giản.",
        description:
          "Quy trình này chỉ giải thích cách bếp dự kiến nhận thông tin, không phải luồng mua hàng trực tuyến."
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
      title: "Nấu như cho người nhà, phục vụ như một lời hẹn tử tế.",
      body: [
        "Bếp Nhà Mình bắt đầu từ mong muốn làm những phần ăn lành mạnh, dễ ăn và không cầu kỳ cho người bận rộn.",
        "Thay vì mở bán đại trà, bếp chọn cách nhận đăng ký trước để chuẩn bị nguyên liệu vừa đủ, nấu mới trong ngày và giữ nhịp vận hành nhỏ gọn."
      ],
      note: "Hiện bếp đang hoàn thiện menu mở bán. Thông tin trên website là nội dung giới thiệu và ghi danh chờ."
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
        title: "Xem menu",
        description: "Menu dự kiến được thông báo theo từng đợt mở bán."
      },
      {
        step: "02",
        title: "Nhắn tin hoặc đăng ký",
        description: "Bạn để lại thông tin để bếp gửi thông báo sớm."
      },
      {
        step: "03",
        title: "Bếp xác nhận",
        description: "Bếp xác nhận số lượng, khu vực và thời gian phù hợp."
      },
      {
        step: "04",
        title: "Chuẩn bị và nấu mới",
        description: "Nguyên liệu được chuẩn bị theo đơn đã xác nhận."
      },
      {
        step: "05",
        title: "Giao món",
        description: "Món được đóng gói gọn gàng và giao trong khung hẹn."
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
      eyebrow: "Ghi danh chờ",
      title: "Nhận thông báo khi Bếp Nhà Mình mở bán",
      description:
        "Để lại khu vực và bữa ăn bạn quan tâm. Bếp chỉ dùng thông tin này để gửi thông báo mở bán.",
      successMessage:
        "Bếp đã nhận được thông tin của bạn. Khi menu mở bán, Bếp Nhà Mình sẽ gửi thông báo sớm nhất.",
      note:
        "Biểu mẫu dùng để ghi danh chờ thông báo mở bán, không tạo đơn hàng và không xử lý thanh toán.",
      form: {
        name: "Tên",
        district: "Khu vực/quận",
        phone: "Số điện thoại",
        email: "Email",
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
      title: "Theo dõi hành trình của bếp",
      description:
        "Menu thử nghiệm, hình ảnh chuẩn bị món và lịch mở bán sẽ được cập nhật trên mạng xã hội.",
      links: socialLinks
    },
    footer: {
      description:
        "Website giới thiệu thương hiệu và ghi danh chờ. Địa chỉ, giờ mở bán và thông tin liên hệ chính thức sẽ được cập nhật khi bếp sẵn sàng."
    }
  },
  en: {
    locale: "en",
    nav: [
      { label: "Home", href: "#home" },
      { label: "Story", href: "#story" },
      { label: "Meals", href: "#meals" },
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
      eyebrow: "Fresh healthy meals by pre-order",
      headline: "Healthy meals from a small home kitchen",
      supportingText:
        "Fresh, balanced meals prepared by pre-order for busy weekdays.",
      primaryCta: "Follow the journey",
      secondaryCta: "Get launch updates",
      image:
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85",
      alt: "Healthy rice bowl with vegetables, eggs, and fresh ingredients",
      floatingLabel: "Cooked fresh daily",
      preorderCardTitle: "Simple pre-order",
      preorderCardText: "No cart, no online payment."
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
        title: "Reserve ahead, cook fresh, keep everything simple.",
        description:
          "This explains how the kitchen expects to collect interest, not an online purchase flow."
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
      title: "Cooked like family food, served with a thoughtful promise.",
      body: [
        "Bếp Nhà Mình started from the wish to make healthy, approachable meals for busy people.",
        "Instead of selling at scale, the kitchen collects sign-ups first, prepares just enough ingredients, cooks fresh each day, and keeps operations small."
      ],
      note: "The launch menu is still being finalized. This website is for brand introduction and waitlist sign-ups."
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
        title: "View menu",
        description: "The planned menu is shared by launch batch."
      },
      {
        step: "02",
        title: "Message or sign up",
        description: "Leave your details so the kitchen can send early updates."
      },
      {
        step: "03",
        title: "Kitchen confirms",
        description: "The kitchen confirms quantity, area, and timing."
      },
      {
        step: "04",
        title: "Prep and cook fresh",
        description: "Ingredients are prepared based on confirmed demand."
      },
      {
        step: "05",
        title: "Deliver meals",
        description: "Meals are packed neatly and delivered within the agreed window."
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
      title: "Get notified when Bếp Nhà Mình opens",
      description:
        "Leave your area and preferred meal type. The kitchen only uses this information for launch updates.",
      successMessage:
        "Your details have been received. Bếp Nhà Mình will send an early update when the menu opens.",
      note:
        "This form is only for launch updates. It does not create an order and does not process payment.",
      form: {
        name: "Name",
        district: "Area/district",
        phone: "Phone",
        email: "Email",
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
      title: "Follow the kitchen journey",
      description:
        "Test menus, prep photos, and launch dates will be shared on social channels.",
      links: socialLinks
    },
    footer: {
      description:
        "Brand introduction and waitlist website. Address, opening hours, and official contact information will be updated when the kitchen is ready."
    }
  }
};

export const siteContent = siteContents.vi;
export const preferredMealOptions = siteContents.vi.waitlist.form.options;
