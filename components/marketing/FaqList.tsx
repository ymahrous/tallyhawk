import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/lib/marketing";

/**
 * Native <details> accordion: works without JavaScript, and collapsed answers are still in the HTML
 * that search and answer engines read. Pair with faqPageSchema() for the same items.
 */
export default function FaqList({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-white/10 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
      {items.map((item) => (
        <details
          key={item.question}
          className="group px-6 sm:px-8 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 rounded-lg">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {item.question}
            </h3>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="-mt-2 pb-6 pr-8 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
