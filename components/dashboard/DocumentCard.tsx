import { Extraction, Document } from "@/lib/api";
import { useTheme } from "@/app/providers/ThemeContext";
import SyncButton from "@/components/ui/SyncButton";
import CategoryPage from "@/components/ui/CategoryPage";
import WarningBadge from "@/components/ui/WarningBadge";

interface DocumentCardProps {
  doc: Document;
  ext: Extraction | undefined;
  qbConnected: boolean;
  isDeleting: boolean;
  onCategoryUpdate: (documentId: string, newCategory: string) => void;
  onDelete: (id: string) => void;
}

export default function DocumentCard({ doc, ext, qbConnected, isDeleting, onCategoryUpdate, onDelete }: DocumentCardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const displayName = ext?.vendor?.canonical_name || ext?.extracted_data.vendor;

  return (
    <div className={`p-6 md:p-8 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
      <div className="flex flex-col gap-6">
        {/* Top Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-medium truncate ${isDark ? "text-gray-200" : "text-gray-900"}`}>{doc.filename}</p>
              <WarningBadge flags={doc.flags} />
            </div>
            <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{new Date(doc.created_at).toLocaleDateString()}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {ext && <CategoryPage documentId={doc.id} currentCategory={ext.category} onCategoryUpdate={onCategoryUpdate} />}
            <SyncButton documentId={doc.id} qbConnected={qbConnected} initialSyncedStatus={doc.quickbooks_synced} />
            <button onClick={() => onDelete(doc.id)} disabled={isDeleting} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-gray-600 hover:text-red-400" : "hover:bg-gray-100 text-gray-400 hover:text-red-500"}`} aria-label="Delete">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
          </div>
        </div>

        {/* Bottom Row: Extracted JSON */}
        {ext && (
          <div className="bg-black/80 rounded-xl p-5 border border-white/5">
            <pre className="text-emerald-400 font-mono text-xs leading-loose overflow-x-auto">
              {/* <p className="font-medium">{displayName}</p> */}
              {JSON.stringify((({ category, ...rest }) => rest)(ext.extracted_data), null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}