import type { HowItWorksStep } from "@/lib/marketing";

export default function HowItWorks({ steps }: { steps: readonly HowItWorksStep[] }) {
  return (
    <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="relative rounded-3xl border border-gray-200 bg-white p-8 dark:border-white/10 dark:bg-white/5"
        >
          <span
            aria-hidden="true"
            className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black font-mono text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            {index + 1}
          </span>
          <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            <span className="sr-only">Step {index + 1}: </span>
            {step.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {step.description}
          </p>
        </li>
      ))}
    </ol>
  );
}
