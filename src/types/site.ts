export type NavItem = {
  label: string;
  href: string;
};

export type BrandValue = {
  title: string;
  description: string;
  icon: string;
};

export type Dish = {
  name: string;
  description: string;
  tag: string;
  image: string;
  alt: string;
};

export type WorkflowStep = {
  step: string;
  title: string;
  description: string;
};

export type GalleryItem = {
  title: string;
  description: string;
  image: string;
  alt: string;
};

export type SocialLink = {
  label: string;
  href: string;
};

export type SiteContent = {
  locale: "vi" | "en";
  nav: NavItem[];
  header: {
    brandAriaLabel: string;
    tagline: string;
    waitlistCta: string;
    menuAriaLabel: string;
    desktopNavAriaLabel: string;
    mobileNavAriaLabel: string;
    languageLabel: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    supportingText: string;
    primaryCta: string;
    secondaryCta: string;
    image: string;
    alt: string;
    floatingLabel: string;
    preorderCardTitle: string;
    preorderCardText: string;
  };
  sectionHeadings: {
    values: {
      eyebrow: string;
      title: string;
    };
    dishes: {
      eyebrow: string;
      title: string;
      description: string;
      badge: string;
    };
    workflow: {
      eyebrow: string;
      title: string;
      description: string;
    };
    kitchen: {
      eyebrow: string;
      title: string;
    };
  };
  values: BrandValue[];
  story: {
    eyebrow: string;
    title: string;
    body: string[];
    note: string;
  };
  dishes: Dish[];
  workflow: WorkflowStep[];
  kitchen: GalleryItem[];
  waitlist: {
    eyebrow: string;
    title: string;
    description: string;
    successMessage: string;
    note: string;
    form: {
      name: string;
      district: string;
      phone: string;
      email: string;
      preferredMeal: string;
      submit: string;
      loading: string;
      genericError: string;
      unsafeHtmlError: string;
      phoneHintPrefix: string;
      options: string[];
    };
  };
  social: {
    title: string;
    description: string;
    links: SocialLink[];
  };
  footer: {
    description: string;
  };
};

export type WaitlistFormValues = {
  name: string;
  phone: string;
  email: string;
  district: string;
  preferredMeal: string;
  source: string;
};
