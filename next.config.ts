import type { NextConfig } from "next";

const s3Hostname = process.env.NEXT_PUBLIC_S3_BUCKET_URL;

const nextConfig: NextConfig = {
  // E2E runs build into a separate directory (NEXT_DIST_DIR=.next-e2e, set by playwright.config.ts)
  // so a build pointed at the mock API never overwrites the real `.next` output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    // Next rejects an empty hostname at build time, so only allow the bucket once it's configured.
    remotePatterns: s3Hostname
      ? [{ protocol: "https", hostname: s3Hostname, port: "", pathname: "/**" }]
      : [],
  },
};

export default nextConfig;
