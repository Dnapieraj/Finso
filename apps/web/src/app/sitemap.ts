import type { MetadataRoute } from "next";

import { legalLinks } from "@/content/links";
import { siteUrl } from "@/content/site";

/** Served at /sitemap.xml and generated at build time. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    ...Object.values(legalLinks).map((path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
