import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Capture",
  description: "Capture and manage your edocAI documents.",
  robots: { index: false, follow: false },
};

export default function CaptureLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}