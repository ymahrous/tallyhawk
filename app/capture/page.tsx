"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { uploadDocument } from "@/lib/api";

export default function CapturePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError("");
    setSuccess(false);

    try {
      await uploadDocument(file);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      if (msg === "limit_exceeded") {
        setError("Free tier limit reached. Open dashboard to upgrade.");
      } else {
        setError("Upload failed. Please try again.");
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`h-dvh flex flex-col font-sans antialiased overflow-hidden ${
      isDark ? "bg-black text-white" : "bg-white text-gray-900"
    }`}>
      
      {/* Top Safe Area & Header */}
      {/* FIXED: pt-24 on mobile forces it cleanly below the 64px fixed Navbar. pt-28 on desktop for breathing room */}
      <div className="pt-24 md:pt-28">
        <div className="flex items-center justify-between px-6 pb-4 border-b border-white/10">
          <button onClick={() => router.push("/app")} className={`text-sm font-medium ${!isDark 
                ? "text-black hover:text-black/80 transition" 
                : "text-white hover:text-white/80 transition"}`}>
            ← Back
          </button>
          <h1 className="text-sm font-semibold font-mono">edocAI</h1>
          <div className="w-12" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Viewfinder Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        
        {success ? (
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-emerald-400">Uploaded!</p>
          </div>
        ) : (
          <>
            <div className="w-28 h-28 rounded-4xl bg-indigo-500/10 flex items-center justify-center border-2 border-dashed border-indigo-500/30">
              <svg className="w-14 h-14 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Snap a Receipt</h2>
              <p className={`text-sm max-w-xs mx-auto ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Take a photo or select from gallery. We'll process it instantly.
              </p>
            </div>
          </>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 px-4 py-3 rounded-xl max-w-sm text-center">
            {error}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className={`p-6 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}>
        <label 
          htmlFor="camera-upload" 
          className={`block w-full text-center py-4 rounded-2xl font-semibold text-lg transition-all ${
            isUploading 
              ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-white/10 dark:text-gray-500" 
              : isDark 
                ? "bg-white text-black hover:bg-gray-200" 
                : "bg-black text-white hover:bg-gray-800"
          }`}
        >
          {isUploading ? "Processing..." : success ? "Snap Another" : "Open Camera"}
        </label>
        <input 
          ref={fileInputRef}
          type="file" 
          id="camera-upload" 
          className="hidden" 
          accept="image/jpeg,image/png" 
          capture="environment" 
          onChange={handleCapture}
          disabled={isUploading}
        />
      </div>
    </div>
  );
}