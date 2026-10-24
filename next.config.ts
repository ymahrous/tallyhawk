import type { NextConfig } from "next";

const s3Hostname = process.env.NEXT_PUBLIC_S3_BUCKET_URL;
const isDev = process.env.NODE_ENV === "development";

/** The API's origin when the client is pointed at another one (the test suites do this). */
function apiOrigin(): string | null {
  try {
    return process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : null;
  } catch {
    return null;
  }
}

// Inline scripts are allowed because statically generated pages can't carry a per-request nonce
// (the theme script and Next's own bootstrap are inline). Everything else is locked down: no
// plugins, no framing, no <base> hijacking, and fetches only to this app, its API and analytics.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${s3Hostname ? ` https://${s3Hostname}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https://va.vercel-scripts.com${apiOrigin() ? ` ${apiOrigin()}` : ""}${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Add `; preload` (and submit to hstspreload.org) only once every subdomain is HTTPS-only for good.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The capture page opens the camera through a file input; nothing needs the rest.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // E2E runs build into a separate directory (NEXT_DIST_DIR=.next-e2e, set by playwright.config.ts)
  // so a build pointed at the mock API never overwrites the real `.next` output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  images: {
    // `next build` crashes on an empty hostname, so only allow the bucket once it's configured.
    remotePatterns: s3Hostname
      ? [{ protocol: "https", hostname: s3Hostname, port: "", pathname: "/**" }]
      : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses carry account data: never cache them anywhere.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};

export default nextConfig;
