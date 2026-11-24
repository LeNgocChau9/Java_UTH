"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Globe } from "lucide-react";
import { CircularFlag } from "./CircularFlag";
import { useLanguage, type LanguageCode, SUPPORTED_LANGUAGES } from "@/context/LanguageContext";

interface LanguageSwitcherProps {
  variant?: "landing" | "app" | "compact";
  isDark?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  variant = "landing",
  isDark = false,
  className = "",
}: LanguageSwitcherProps) {
  const { language, setLanguage, languageMeta, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  // Button styling according to variant
  const isLanding = variant === "landing";
  const isApp = variant === "app";

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Chọn ngôn ngữ (Hiện tại: ${languageMeta.name})`}
        title={`Ngôn ngữ: ${languageMeta.name}`}
        className={`flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
          isLanding
            ? `h-10 rounded-full px-3 text-xs font-bold ${
                isDark
                  ? "bg-white/10 text-white hover:bg-white/18 border border-white/15"
                  : "bg-white text-[#211D16] hover:bg-[#F3F4F6] border-2 border-[#211D16]/20 shadow-xs"
              }`
            : isApp
            ? "h-9 rounded-full px-2.5 text-xs font-semibold bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-xs"
            : "h-8 rounded-full p-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
        }`}
      >
        <CircularFlag code={language} size={18} />
        <span className="hidden sm:inline font-bold tracking-tight">
          {languageMeta.shortCode}
        </span>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 opacity-70 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl p-1.5 shadow-2xl z-50 backdrop-blur-md transition-all duration-150 animate-in fade-in slide-in-from-top-1"
          style={{
            backgroundColor: isLanding && isDark ? "rgba(24, 24, 27, 0.96)" : "#FFFFFF",
            border: isLanding && isDark ? "1px solid rgba(255, 255, 255, 0.16)" : "1.5px solid #E2E8F0",
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.28), 0 0 1px 1px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Menu Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{
              borderColor: isLanding && isDark ? "rgba(255, 255, 255, 0.1)" : "#F1F5F9",
            }}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide">
              <Globe size={14} className="text-emerald-500" />
              <span style={{ color: isLanding && isDark ? "#F4F4F5" : "#0F172A" }}>
                {t("lang.select", "Chọn ngôn ngữ")}
              </span>
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: isLanding && isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9",
                color: isLanding && isDark ? "#A1A1AA" : "#64748B",
              }}
            >
              7 Ngôn ngữ
            </span>
          </div>

          {/* Language Options List */}
          <div className="py-1 max-h-80 overflow-y-auto space-y-0.5">
            {SUPPORTED_LANGUAGES.map((item) => {
              const isSelected = item.code === language;
              return (
                <button
                  key={item.code}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectLanguage(item.code)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? isLanding && isDark
                        ? "bg-emerald-500/20 text-emerald-300 font-bold"
                        : "bg-emerald-50 text-emerald-800 font-bold"
                      : isLanding && isDark
                      ? "text-zinc-200 hover:bg-white/8"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CircularFlag code={item.code} size={22} />
                    <div className="min-w-0 leading-tight">
                      <div className="text-xs truncate">{item.name}</div>
                      <div
                        className="text-[10px] opacity-75 font-normal truncate mt-0.5"
                        style={{
                          color: isLanding && isDark ? "#A1A1AA" : "#64748B",
                        }}
                      >
                        {item.nativeName} • {item.country}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Badge: Tự hào sáng tạo bởi lập trình viên Việt Nam */}
          <div
            className="mt-1 pt-2 pb-1 px-3 border-t text-center rounded-b-xl"
            style={{
              borderColor: isLanding && isDark ? "rgba(255, 255, 255, 0.1)" : "#F1F5F9",
              background: isLanding && isDark ? "rgba(218, 37, 29, 0.12)" : "#FFF5F5",
            }}
          >
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-700">
              <CircularFlag code="vi" size={14} />
              <span>LivingDocs • Make in Vietnam 🇻🇳</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
              {t("app.madeInVietnamTooltip", "Phát triển bởi đội ngũ lập trình viên Việt Nam")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
