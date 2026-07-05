import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

interface UploadZoneProps {
  isUploading: boolean;
  uploadProgress: number;
  dragActive: boolean;
  onUpload: (file: File) => void;
  setDragActive: (active: boolean) => void;
  onValidationError: (message: string) => void; // NEW PROP
}

export default function UploadZone({ isUploading, uploadProgress, dragActive, onUpload, setDragActive, onValidationError }: UploadZoneProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validateFile = (file: File): string | null => {
    // 1. Check Extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      return `Unsupported file extension. Please upload ${ACCEPTED_EXTENSIONS.join(", ")}.`;
    }

    // 2. Check MIME Type
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported file type: ${file.type}. Accepted: PDF, JPG, PNG.`;
    }

    // 3. Check Size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
    }

    return null; // Valid file
  };

  const processFile = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setSelectedFile(null);
      onValidationError(error); // Send error to parent
      return;
    }
    setSelectedFile(file);
    onUpload(file); // Proceed with upload
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-12 mb-4 flex flex-col items-center justify-center transition-all duration-300 backdrop-blur-sm ${
        dragActive 
          ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]" 
          : isDark 
            ? "border-white/10 bg-white/5 hover:bg-white/10" 
            : "border-gray-300 bg-white hover:border-gray-400"
      }`}
      onDragEnter={handleDrag} 
      onDragLeave={handleDrag} 
      onDragOver={handleDrag} 
      onDrop={handleDrop}
    >
      <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-4">
        <div className={`p-4 rounded-2xl ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
          <svg className={`w-8 h-8 ${isDark ? "text-gray-400" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className={`font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Drop files here or <span className={`underline ${!isDark ? "text-black hover:text-black/50" : "text-white hover:text-white/50"}`}>browse</span>
          </p>
          <p className={`text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
            PDF, JPG, PNG up to {MAX_FILE_SIZE_MB}MB
          </p>
          {selectedFile && !isUploading && (
            <p className={`text-xs mt-1 truncate max-w-[200px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Selected: {selectedFile.name}
            </p>
          )}
        </div>
      </label>
      {/* UPDATED: Use MIME types in accept attribute for stricter browser filtering */}
      <input 
        type="file" 
        id="file-upload" 
        className="hidden" 
        accept="application/pdf,image/jpeg,image/png" 
        onChange={handleFileChange} 
      />

      {isUploading && (
        <div className="w-full mt-8 max-w-sm">
          <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className={`text-xs mt-2 text-center ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}
    </div>
  );
}