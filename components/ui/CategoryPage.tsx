"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { usePlan } from "@/app/providers/PlanContext";
import { updateCategory } from "@/lib/api";

const CATEGORIES = ["Travel", "Meals", "Software", "Office Supplies", "Equipment", "Marketing", "Utilities", "Rent", "Insurance", "Professional Services", "Other"];

interface CategoryBadgeProps {
  documentId: string;
  currentCategory?: string;
  onCategoryUpdate: (documentId: string, newCategory: string) => void; // NEW PROP
}

export default function CategoryPage({ documentId, currentCategory, onCategoryUpdate }: CategoryBadgeProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { plan } = usePlan();
  
  const category = currentCategory || "Other";
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUpdate = async (newCat: string) => {
    if (newCat === category) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await updateCategory(documentId, newCat);
      onCategoryUpdate(documentId, newCat); // UPDATE LOCAL STATE INSTANTLY
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update category", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (plan !== "pro") {
    return (
      <span className={`text-xs px-2 py-1 rounded-md ${isDark ? "bg-white/10 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
        {category}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsEditing(!isEditing)}
        className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${isDark ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}
      >
        {category}
      </button>

      {isEditing && (
        <div className={`absolute z-50 top-8 right-0 w-48 max-h-64 overflow-y-auto rounded-xl border shadow-lg ${
          isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"
        }`}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleUpdate(cat)}
              disabled={isLoading}
              className={`w-full text-left text-xs px-3 py-2 transition-colors ${
                cat === category 
                  ? isDark ? "bg-indigo-500/30 text-white" : "bg-indigo-50 text-indigo-700"
                  : isDark ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}