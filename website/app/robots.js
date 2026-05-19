import { SITE_URL } from "./seo-config";

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
