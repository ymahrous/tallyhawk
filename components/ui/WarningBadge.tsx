"use client";

import { useTheme } from "@/app/providers/ThemeContext";

export default function WarningBadge({ flags }: { flags?: string | null }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (!flags) return null;

  const flagList = flags.split(",");

  return (
    <div className="flex items-center gap-2">
      {flagList.map((flag) => {
        const isDuplicate = flag.trim() === "possible_duplicate";
        const label = isDuplicate ? "Duplicate" : "Anomaly";
        const iconPath = isDuplicate
          ? "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
          : "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z";

        return (
          <span
            key={flag}
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
              isDuplicate
                ? "bg-yellow-500/10 text-yellow-500 ring-yellow-500/30"
                : "bg-orange-500/10 text-orange-500 ring-orange-500/30"
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
            {label}
          </span>
        );
      })}
    </div>
  );
}