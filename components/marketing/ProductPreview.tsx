import { Camera, Check, FileText, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewRow {
  file: string;
  vendor: string;
  status: "Processing" | "Completed";
  category: string;
  amount: string;
  converted?: string;
  synced: boolean;
  photo?: boolean;
}

const ROWS: PreviewRow[] = [
  {
    file: "aws_billing.pdf",
    vendor: "Amazon Web Services",
    status: "Processing",
    category: "Hosting",
    amount: "$159.90",
    synced: false,
  },
  {
    file: "receipt_hw.jpg",
    vendor: "Apple Store",
    status: "Completed",
    category: "Equipment",
    amount: "$224.08",
    synced: true,
    photo: true,
  },
  {
    file: "invoice_q3.pdf",
    vendor: "Hetzner Online",
    status: "Completed",
    category: "Hosting",
    amount: "€44.60",
    converted: "$48.50",
    synced: true,
  },
];

const STATS = [
  { label: "Processed", value: "24" },
  { label: "Synced", value: "18", accent: true },
  { label: "This month (USD)", value: "$5,459" },
];

function StatusPill({ status }: { status: PreviewRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
        status === "Processing"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
      )}
    >
      {status}
    </span>
  );
}

function SyncState({ synced }: { synced: boolean }) {
  return synced ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Synced
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:text-gray-400">
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Sync to QB
    </span>
  );
}

/** Illustrative dashboard for the landing page hero. Decorative data, exposed to assistive tech as one image. */
export default function ProductPreview() {
  return (
    <figure
      role="img"
      aria-label="Tallyhawk dashboard showing extracted receipts and invoices with vendor, category, amount and QuickBooks sync status"
      className="relative mx-auto max-w-5xl"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-x-8 -top-10 -bottom-10 -z-10 rounded-[3rem] bg-linear-to-r from-indigo-500/20 via-violet-500/10 to-emerald-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="rounded-2xl sm:rounded-3xl border border-gray-200 bg-gray-100/80 p-1 shadow-2xl shadow-gray-300/50 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/50"
      >
        <div className="rounded-2xl sm:rounded-[20px] bg-white p-4 sm:p-6 md:p-8 dark:bg-black/60">
          <div className="mb-4 sm:mb-6 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500/80" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <span className="h-3 w-3 rounded-full bg-green-500/80" />
            <span className="ml-4 font-mono text-xs text-gray-500 dark:text-gray-400">
              app.tallyhawk / documents
            </span>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-6 dark:border-white/5 dark:bg-black/60">
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 sm:flex-col sm:items-start sm:justify-start dark:border-white/5 dark:bg-white/5"
                >
                  <p className="text-xs text-gray-500 sm:mb-1 dark:text-gray-400">{stat.label}</p>
                  <p
                    className={cn(
                      "text-xl font-semibold",
                      stat.accent
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-gray-900 dark:text-white"
                    )}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="hidden md:grid grid-cols-12 gap-4 border-b border-gray-200 pb-3 text-xs font-medium text-gray-500 dark:border-white/10 dark:text-gray-400">
              <div className="col-span-4">Document</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2 text-right">QuickBooks</div>
            </div>

            {ROWS.map((row, index) => {
              const Icon = row.photo ? Camera : FileText;
              return (
                <div
                  key={row.file}
                  className={cn(
                    "py-4",
                    index < ROWS.length - 1 && "border-b border-gray-100 dark:border-white/5"
                  )}
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center md:gap-4">
                    <div className="col-span-4 flex items-center justify-between gap-3 md:justify-start">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 dark:bg-white/10">
                          <Icon className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {row.file}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{row.vendor}</p>
                        </div>
                      </div>
                      <div className="md:hidden">
                        <SyncState synced={row.synced} />
                      </div>
                    </div>
                    <div className="col-span-8 flex items-center justify-between md:contents">
                      <div className="md:col-span-2">
                        <StatusPill status={row.status} />
                      </div>
                      <div className="text-sm text-gray-600 md:col-span-2 dark:text-gray-400">
                        {row.category}
                      </div>
                      <div className="text-sm font-medium text-gray-900 md:col-span-2 dark:text-white">
                        {row.amount}
                        {row.converted && (
                          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                            → {row.converted}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 hidden text-right md:block">
                        <SyncState synced={row.synced} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </figure>
  );
}
