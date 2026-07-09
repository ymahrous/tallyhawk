import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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