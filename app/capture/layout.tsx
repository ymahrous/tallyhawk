import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Capture",
  description: "Snap a receipt with your phone camera and send it to Tallyhawk.",
});

export default function CaptureLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
