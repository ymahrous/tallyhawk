import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs build into a separate directory (NEXT_DIST_DIR=.next-e2e, set by playwright.config.ts)
  // so a build pointed at the mock API never overwrites the real `.next` output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_S3_BUCKET_URL || "",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
