import { useId } from "react";
import {
  BRAND_COLORS,
  BRAND_NAME,
  LOGO_GRADIENT,
  LOGO_HAWK_PATH,
  LOGO_TILE_RADIUS,
  LOGO_VIEWBOX_SIZE,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  /** Accessible name. Omit when the mark sits next to visible "Tallyhawk" text so it isn't read twice. */
  title?: string;
}

export function LogoMark({ className, title }: LogoMarkProps) {
  // Gradient ids must be unique per instance; the navbar and footer both render the mark.
  const gradientId = `tallyhawk-mark-${useId().replace(/:/g, "")}`;
  const size = LOGO_VIEWBOX_SIZE;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1={LOGO_GRADIENT.x1}
          y1={LOGO_GRADIENT.y1}
          x2={LOGO_GRADIENT.x2}
          y2={LOGO_GRADIENT.y2}
          gradientUnits="userSpaceOnUse"
        >
          {LOGO_GRADIENT.stops.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      <rect width={size} height={size} rx={LOGO_TILE_RADIUS} fill={`url(#${gradientId})`} />
      <path d={LOGO_HAWK_PATH} fill={BRAND_COLORS.white} fillRule="evenodd" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}

/** Mark + wordmark lockup used in the navbar and footer. */
export function Logo({ className, markClassName, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("h-7 w-7", markClassName)} />
      <span className={cn("text-lg font-semibold tracking-tight", wordmarkClassName)}>
        {BRAND_NAME}
      </span>
    </span>
  );
}
