import type { MetadataRoute } from "next";

import { siteUrl } from "@/content/site";

/** Served at /robots.txt: the whole site is public, so everything may be crawled. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
