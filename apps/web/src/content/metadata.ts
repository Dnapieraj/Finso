import type { Metadata } from "next";

import { pl } from "@/messages/pl";

const SITE_NAME = "Finso";

/**
 * Metadata for one page: title, description, canonical URL and Open Graph.
 * Paths are relative; `metadataBase` in the root layout makes them absolute.
 * Open Graph is rebuilt in full because Next replaces a parent's
 * `openGraph` object instead of merging it.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  /** Page name, shown as "Name — Finso". Omit for the home page. */
  title?: string;
  description: string;
  path: string;
}): Metadata {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : pl.meta.title;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
    },
  };
}
