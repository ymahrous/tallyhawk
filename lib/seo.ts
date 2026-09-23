import type { Metadata } from "next";
import { SITE_LOCALE, SITE_NAME } from "@/lib/site";

/** Robots directives for indexable pages: allow large image previews and full-length snippets. */
export const INDEXABLE_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

interface PageMetadataOptions {
  /** Page title; the root layout's template appends " | Tallyhawk" unless `absoluteTitle` is set. */
  title: string;
  description: string;
  /** Canonical path, e.g. "/pricing". */
  path: string;
  absoluteTitle?: boolean;
}

/**
 * Metadata for an indexable page. Next.js merges metadata *shallowly*, so a segment that sets
 * `openGraph` replaces the parent's object wholesale — this helper always emits the complete set
 * (canonical, Open Graph, Twitter card, robots) so nothing silently falls back to the home page's
 * values. Images come from the route's `opengraph-image.tsx`; Twitter copies them from Open Graph.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: PageMetadataOptions): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: SITE_LOCALE,
      siteName: SITE_NAME,
      url: path,
      title: socialTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
    robots: INDEXABLE_ROBOTS,
  };
}

/** Metadata for signed-in or one-time pages that must never appear in search results. */
export function privatePageMetadata({
  title,
  description,
}: {
  title: string;
  description: string;
}): Metadata {
  return { title, description, robots: NOINDEX_ROBOTS };
}
