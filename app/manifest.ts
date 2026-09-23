import type { MetadataRoute } from "next";
import { BRAND_COLORS } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_LANGUAGE, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Matches the previous start_url-derived id so existing home-screen installs keep their identity.
    id: "/capture",
    name: `${SITE_NAME} — AI Receipt Capture`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    // The installed app opens straight into the camera flow for snapping receipts.
    start_url: "/capture",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_COLORS.ink,
    theme_color: BRAND_COLORS.ink,
    lang: SITE_LANGUAGE,
    dir: "ltr",
    categories: ["finance", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      {
        name: "Capture a receipt",
        short_name: "Capture",
        url: "/capture",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Open dashboard",
        short_name: "Dashboard",
        url: "/app",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
