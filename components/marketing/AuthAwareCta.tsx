"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useIsLoggedIn } from "@/lib/useIsLoggedIn";
import { cn } from "@/lib/utils";

export const primaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold transition-all bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";

export const secondaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-base font-semibold transition-all border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";

interface AuthAwareCtaProps {
  primaryLabel?: string;
  secondary?: { href: string; label: string };
  className?: string;
}

/**
 * Marketing CTA that swaps to "Open dashboard" for signed-in visitors. Server HTML (and crawlers)
 * always get the signup links; the swap happens after hydration.
 */
export default function AuthAwareCta({
  primaryLabel = "Start free",
  secondary,
  className,
}: AuthAwareCtaProps) {
  const isLoggedIn = useIsLoggedIn();

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-center gap-3", className)}>
      {isLoggedIn ? (
        <Link href="/app" className={primaryCtaClass}>
          Open dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <>
          <Link href="/signup" className={primaryCtaClass}>
            {primaryLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {secondary && (
            <Link href={secondary.href} className={secondaryCtaClass}>
              {secondary.label}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
