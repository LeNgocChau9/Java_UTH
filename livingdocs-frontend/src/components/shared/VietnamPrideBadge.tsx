"use client";

import React, { useState } from "react";
import { CircularFlag } from "./CircularFlag";
import { useLanguage } from "@/context/LanguageContext";

interface VietnamPrideBadgeProps {
  variant?: "compact" | "pill" | "footer";
  className?: string;
  isDark?: boolean;
}

export function VietnamPrideBadge({
  variant = "pill",
  className = "",
  isDark = false,
}: VietnamPrideBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { t } = useLanguage();

  if (variant === "footer") {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-200 ${className}`}
        style={{
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(33,29,22,0.04)",
          border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(33,29,22,0.1)",
          color: isDark ? "#E4E4E7" : "#334155",
        }}
      >
        <CircularFlag code="vi" size={17} />
        <span>{t("footer.proudlyCrafted", "Thiết kế & phát triển với niềm tự hào tại Việt Nam 🇻🇳")}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`relative inline-flex items-center ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onTouchStart={() => setShowTooltip((p) => !p)}
      >
        <button
          type="button"
          aria-label="Tự hào sản phẩm Việt Nam"
          className="group relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{
            background: isDark ? "rgba(255,255,255,0.08)" : "#ffffff",
            border: isDark ? "1.5px solid rgba(255,255,255,0.16)" : "1.5px solid #cbd5e1",
            boxShadow: isDark
              ? "0 2px 8px rgba(0,0,0,0.3)"
              : "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Subtle pulse ring around Vietnam flag */}
          <span className="absolute -inset-0.5 rounded-full bg-red-500/20 opacity-0 blur-[2px] transition-opacity duration-300 group-hover:opacity-100" />
          <CircularFlag code="vi" size={20} />
        </button>

        {/* Hover Tooltip */}
        {showTooltip && (
          <div
            className="absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-center text-xs font-bold text-white shadow-xl backdrop-blur-md transition-all duration-200 pointer-events-none"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.94)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              animation: "fadeIn 0.15s ease-out",
            }}
          >
            <div className="flex items-center gap-1.5 justify-center">
              <CircularFlag code="vi" size={13} />
              <span className="text-amber-300 font-extrabold">{t("app.madeInVietnam", "Tự hào sản phẩm Make in Vietnam")}</span>
            </div>
            <div className="text-[10px] text-slate-300 font-normal mt-0.5">
              {t("app.madeInVietnamTooltip", "Nền tảng LivingDocs được phát triển bởi lập trình viên Việt Nam 🇻🇳")}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Variant: "pill" (default, ideal for Landing Navbar)
  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={() => setShowTooltip((p) => !p)}
    >
      <div
        className="group flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 hover:scale-[1.02]"
        style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(218,37,29,0.18) 0%, rgba(255,255,255,0.06) 100%)"
            : "linear-gradient(135deg, #FFF1F0 0%, #FFFFFF 100%)",
          border: isDark ? "1.5px solid rgba(218,37,29,0.45)" : "1.5px solid #FECACA",
          color: isDark ? "#FCA5A5" : "#991B1B",
          boxShadow: isDark
            ? "0 2px 10px rgba(218,37,29,0.2)"
            : "0 1px 3px rgba(220,38,38,0.08)",
        }}
      >
        <span className="relative flex items-center justify-center">
          <CircularFlag code="vi" size={17} />
          {/* Subtle live indicator dot */}
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </span>
        <span className="tracking-tight hidden md:inline">
          {t("app.madeInVietnamShort", "Make in Vietnam")}
        </span>
      </div>

      {/* Floating Tooltip with detail */}
      {showTooltip && (
        <div
          className="absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 w-64 rounded-xl p-2.5 text-center text-xs font-medium text-white shadow-2xl backdrop-blur-md transition-all duration-200 pointer-events-none"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            boxShadow: "0 12px 28px -4px rgba(0,0,0,0.45)",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1 font-bold text-amber-300">
            <CircularFlag code="vi" size={15} />
            <span>{t("app.madeInVietnam", "Tự hào sản phẩm Make in Vietnam")}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-200 m-0">
            {t("app.madeInVietnamTooltip", "Nền tảng LivingDocs được thiết kế và phát triển bởi lập trình viên Việt Nam 🇻🇳")}
          </p>
        </div>
      )}
    </div>
  );
}
