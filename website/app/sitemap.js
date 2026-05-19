import { SITE_URL } from "./seo-config";

export default function sitemap() {
  const now = new Date();
  return [
    { url: SITE_URL,             lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/paper`,  lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];
}
