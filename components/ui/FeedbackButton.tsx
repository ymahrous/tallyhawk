"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { sendFeedback } from "@/lib/api";
import { FEEDBACK_TYPES, MAX_FEEDBACK_LENGTH, type FeedbackType } from "@/lib/support";
import { useSessionRole } from "@/lib/useSessionRole";

const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

export default function FeedbackButton() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();
  const role = useSessionRole();

  const [isOpen, setIsOpen] = useState(false);
  const [activeType, setActiveType] = useState<FeedbackType>("Suggestion");
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  // Feedback comes from customers and visitors; admins read it in the dashboard instead.
  if (role === "admin" || pathname?.startsWith("/admin")) return null;

  const handleSend = async () => {
    // Sent as typed (trimmed): React escapes it wherever it's displayed, so escaping here would
    // only mangle "<" and ">" in the message.
    const message = text.trim();
    if (!message) return;

    setIsSending(true);
    setError("");

    try {
      await sendFeedback(activeType, message, pathname || undefined);

      setIsSent(true);
      setTimeout(() => {
        setIsOpen(false);
        setText("");
        setIsSent(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const primaryBtnClass = `text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
    isDark
      ? "bg-white text-black hover:bg-gray-200"
      : "bg-black text-white hover:bg-gray-800"
  }`;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      
      {/* Floating Bottom-Right Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Send feedback"
        aria-expanded={isOpen}
        aria-controls="feedback-panel"
        tabIndex={isOpen ? -1 : 0}
        className={`p-3.5 rounded-full shadow-lg transition-all duration-200 hover:scale-110 ${
          isDark
            ? "bg-white text-black hover:bg-gray-200"
            : "bg-black text-white hover:bg-gray-800"
        } ${
          isOpen ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100"
        }`}
      >
        <ChatIcon />
      </button>

      {/* Modal Box - Responsive positioning for mobile & desktop */}
      <div 
        id="feedback-panel"
        role="dialog"
        aria-label="Send feedback"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`absolute bottom-0 right-0 w-[calc(100vw-3rem)] sm:w-96 transition-all duration-200 origin-bottom-right ${
          isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className={`rounded-xl shadow-2xl p-5 sm:p-6 flex flex-col gap-4 border backdrop-blur-xl ${
          isDark 
            ? "bg-black/90 border-white/10 text-white" 
            : "bg-white/90 border-gray-200 text-gray-900"
        }`}>
          
          <h2 className="text-lg font-semibold tracking-tight">Send feedback</h2>

          {/* Segmented Control for Type */}
          <div className="flex gap-2">
            {FEEDBACK_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                aria-pressed={activeType === type}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  activeType === type
                    ? isDark
                      ? "border-white/30 bg-white/10 text-white" 
                      : "border-gray-900 bg-gray-100 text-gray-900" 
                    : isDark
                    ? "border-white/10 bg-transparent text-gray-400 hover:border-white/20" 
                    : "border-gray-200 bg-transparent text-gray-500 hover:border-gray-300" 
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <textarea
            aria-label="Feedback message"
            value={text}
            maxLength={MAX_FEEDBACK_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              activeType === "Suggestion"
                ? "What would make Tallyhawk better?"
                : activeType === "Bug"
                ? "What went wrong?"
                : "Tell us what's on your mind..."
            }
            className={`w-full h-28 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 resize-none border ${
              isDark
                ? "bg-white/5 border-white/10 text-white placeholder-gray-500 focus:ring-white/30 focus:border-white/30"
                : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-gray-300 focus:border-gray-300"
            }`}
          />

          {error && (
            <p role="alert" className="text-sm text-red-500">{error}</p>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!text.trim() || isSending}
              className={`${primaryBtnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isSent ? "Sent!" : isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}