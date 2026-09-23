import {
  BarChart3,
  Building2,
  Coins,
  RefreshCw,
  ScanText,
  ShieldAlert,
  Smartphone,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { Feature, FeatureIcon } from "@/lib/marketing";

const ICONS: Record<FeatureIcon, LucideIcon> = {
  extract: ScanText,
  sync: RefreshCw,
  tax: Tags,
  vendors: Building2,
  currency: Coins,
  flags: ShieldAlert,
  analytics: BarChart3,
  capture: Smartphone,
};

export default function FeatureGrid({ features }: { features: readonly Feature[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {features.map((feature) => {
        const Icon = ICONS[feature.icon];
        return (
          <li
            key={feature.title}
            className="group rounded-3xl border border-gray-200 bg-gray-50 p-6 transition-colors hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
          >
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500/15 to-emerald-500/15 ring-1 ring-inset ring-indigo-500/20">
              <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {feature.description}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
