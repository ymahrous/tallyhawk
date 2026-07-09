import Image from "next/image";
import { Extraction, Document } from "@/lib/api";
import SyncButton from "@/components/ui/SyncButton";
import { useTheme } from "@/app/providers/ThemeContext";
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
  const displayName = ext?.vendor?.canonical_name || ext?.extracted_data?.vendor || "Unknown";
  const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(doc.filename) || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(doc.s3_url);
  const disableActions = (e: React.SyntheticEvent) => {
    e.preventDefault();
  };

  return (
    <div className={`p-6 md:p-8 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
      <div className="flex flex-col gap-6">
        
        {/* Top Row: Preview & File Info */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            
            {/* Document Preview */}
            <div className={`w-16 h-16 rounded-xl shrink-0 flex items-center justify-center overflow-hidden border ${
              isDark ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"
            }`}>
              {isImage ? (
                <Image 
                  src={doc.s3_url} 
                  alt={doc.filename} 
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  onContextMenu={disableActions}
                  onDragStart={disableActions}
                />
              ) : (
                <svg className={`w-8 h-8 ${isDark ? "text-gray-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              )}
            </div>

            {/* File Name & Date */}
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-medium truncate ${isDark ? "text-gray-200" : "text-gray-900"}`}>{doc.filename}</p>
                <WarningBadge flags={doc.flags} />
              </div>
              <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{new Date(doc.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            {ext && <CategoryPage documentId={doc.id} currentCategory={ext.category} onCategoryUpdate={onCategoryUpdate} />}
            <SyncButton documentId={doc.id} qbConnected={qbConnected} initialSyncedStatus={doc.quickbooks_synced} />
            <button 
              onClick={() => onDelete(doc.id)} 
              disabled={isDeleting} 
              className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-gray-600 hover:text-red-400" : "hover:bg-gray-100 text-gray-400 hover:text-red-500"}`} 
              aria-label="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
          </div>
        </div>

        {/* Bottom Row: Extracted Data UI */}
        {ext && (
          <div className={`rounded-xl p-5 border ${isDark ? "bg-black/40 border-white/5" : "bg-gray-50 border-gray-200"}`}>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              
              {/* Vendor (Uses the clean relationship name) */}
              <div className="col-span-2">
                <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Vendor</p>
                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{displayName}</p>
              </div>

              {/* Amount */}
              <div>
                <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Amount</p>
                <p className={`text-sm font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                  {ext.extracted_data.total_amount || "N/A"}
                </p>
              </div>

              {/* Date */}
              <div>
                <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Date</p>
                <p className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  {ext.extracted_data.date || "N/A"}
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}