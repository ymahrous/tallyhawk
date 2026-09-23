import type { GlanceFact } from "@/lib/marketing";

/** Fact sheet as a definition list — the compact, quotable format answer engines extract best. */
export default function AtAGlance({
  facts,
  labelledBy,
}: {
  facts: readonly GlanceFact[];
  labelledBy: string;
}) {
  return (
    <dl
      aria-labelledby={labelledBy}
      className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-2 dark:border-white/10 dark:bg-white/10"
    >
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="flex flex-col gap-1 bg-white px-6 py-5 dark:bg-neutral-950"
        >
          <dt className="font-mono text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {fact.label}
          </dt>
          <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
