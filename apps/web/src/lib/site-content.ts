import { createSiteContents } from "@bep-nha-minh/shared/content/site-content";

export const siteContents = createSiteContents({
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL
});
