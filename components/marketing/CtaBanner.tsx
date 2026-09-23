import AuthAwareCta from "@/components/marketing/AuthAwareCta";
import { PRODUCT_FACTS } from "@/lib/site";

export default function CtaBanner() {
  return (
    <section aria-labelledby="cta-heading" className="mx-auto max-w-5xl px-6 pb-32">
      <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 px-6 py-14 text-center sm:px-12 dark:border-white/10 dark:bg-white/5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-xl -translate-x-1/2 rounded-full bg-linear-to-r from-indigo-500/25 to-emerald-500/25 blur-3xl"
        />
        <div className="relative">
          <h2
            id="cta-heading"
            className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white"
          >
            Ready to stop typing receipts?
          </h2>
          <p className="mx-auto mt-4 mb-8 max-w-md text-base text-gray-600 dark:text-gray-400">
            {PRODUCT_FACTS.freeDocumentsPerMonth} documents free every month. No credit card
            required.
          </p>
          <AuthAwareCta primaryLabel="Get started for free" />
        </div>
      </div>
    </section>
  );
}
