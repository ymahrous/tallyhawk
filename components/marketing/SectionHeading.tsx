import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

// Marketing pages are Server Components, so they style dark mode with Tailwind's `dark:` variant
// (the `dark` class is on <html> before hydration) instead of the useTheme() ternaries used in the app.
export default function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-12 max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white text-balance"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );
}
