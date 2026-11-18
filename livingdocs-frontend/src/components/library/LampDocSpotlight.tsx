"use client";

import React from "react";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";

export interface LampDocSpotlightProps {
  lit: boolean;
  isDark?: boolean;
}

const DOC_LINES = [
  {
    stale: "Tham số đầu vào cũ chưa được cập nhật",
    fresh: "Đã bổ sung đầy đủ tham số mới nhất",
  },
  {
    stale: "Mô tả kết quả trả về đang bị lệch pha",
    fresh: "Mô tả đầu ra đã khớp với mã nguồn hiện tại",
  },
  {
    stale: "Thiếu ghi chú cho thay đổi vừa bổ sung",
    fresh: "Sẵn sàng rà soát và xuất bản phiên bản mới",
  },
];

export default function LampDocSpotlight({
  lit,
  isDark = false,
}: LampDocSpotlightProps) {
  return (
    <div className="relative flex h-[320px] w-full items-end justify-start overflow-hidden rounded-[26px] sm:h-[340px]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes ld-lamp-sway {
            0%, 100% { transform: rotate(28deg); }
            50% { transform: rotate(25deg); }
          }
          @keyframes ld-doc-morph {
            0% {
              opacity: 0;
              transform: translateY(6px);
              filter: blur(3px);
            }
            100% {
              opacity: 1;
              transform: translateY(0px);
              filter: blur(0px);
            }
          }
        `,
        }}
      />

      {/* Diagonal Volumetric Light Cone shining from Top-Right Lamp onto Bottom-Left Document */}
      <svg
        viewBox="0 0 520 340"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full transition-opacity duration-500"
        style={{ opacity: lit ? 1 : 0 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="ld-diag-beam"
            x1="88%"
            y1="14%"
            x2="24%"
            y2="88%"
          >
            <stop
              offset="0%"
              stopColor={isDark ? "#FDE68A" : "#FACC15"}
              stopOpacity={isDark ? "0.52" : "0.48"}
            />
            <stop
              offset="48%"
              stopColor={isDark ? "#FDE68A" : "#FEF08A"}
              stopOpacity={isDark ? "0.22" : "0.26"}
            />
            <stop
              offset="100%"
              stopColor={isDark ? "#34D399" : "#86EFAC"}
              stopOpacity="0"
            />
          </linearGradient>
          <filter id="ld-beam-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <polygon
          points="428,62 468,94 282,340 4,340 62,135"
          fill="url(#ld-diag-beam)"
          filter="url(#ld-beam-blur)"
        />
      </svg>

      {/* Top-Right Angled Ceramic Spotlight Lamp (No On/Off Switch) */}
      <div
        className="pointer-events-none absolute -top-2 right-2 z-20 origin-top sm:right-5"
        style={{
          transform: "rotate(28deg)",
          animation: lit ? "ld-lamp-sway 3.2s ease-in-out infinite" : "none",
          transition: "transform 450ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <svg
          width="112"
          height="118"
          viewBox="0 0 112 118"
          fill="none"
          aria-hidden="true"
        >
          {/* Ceiling Cord */}
          <rect
            x="53"
            y="0"
            width="6"
            height="34"
            rx="3"
            fill={isDark ? "#A8A29E" : "#B47B48"}
          />
          {/* Lamp Cap */}
          <rect
            x="45"
            y="30"
            width="22"
            height="10"
            rx="4"
            fill={isDark ? "#52525B" : "#211D16"}
          />
          {/* Ceramic Shade */}
          <path
            d="M44 38 H68 L94 84 C95.5 86.8 93.5 90 90.3 90 H21.7 C18.5 90 16.5 86.8 18 84 L44 38 Z"
            fill={isDark ? "#27272A" : "#FFFFFF"}
            stroke={isDark ? "#E4E4E7" : "#211D16"}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Inner Shade Rim */}
          <ellipse
            cx="56"
            cy="89"
            rx="34"
            ry="6"
            fill={
              lit
                ? "#FEF08A"
                : isDark
                ? "#18181B"
                : "#E7E5E4"
            }
            stroke={isDark ? "#E4E4E7" : "#211D16"}
            strokeWidth="2.2"
          />
          {/* Bulb */}
          <circle
            cx="56"
            cy="93"
            r="10"
            fill={lit ? "#FDE047" : isDark ? "#3F3F46" : "#D6D3D1"}
            stroke={lit ? "#CA8A04" : isDark ? "#71717A" : "#78716C"}
            strokeWidth="2"
          />
          {/* Warm Bulb Glow Halo when Hover-Lit */}
          {lit && (
            <circle
              cx="56"
              cy="94"
              r="22"
              fill="#FDE047"
              opacity="0.38"
            />
          )}
        </svg>
      </div>

      {/* Bottom-Left Document Sheet: Red (Outdated) when Unlit -> Transforms to Green (Synced) when Lit */}
      <div className="relative z-10 w-full max-w-[375px] p-2 sm:p-3">
        <div
          className="relative overflow-hidden rounded-[22px] border-2 p-4 transition-all duration-500 sm:p-5"
          style={{
            backgroundColor: lit
              ? isDark
                ? "rgba(6, 40, 28, 0.92)"
                : "#F0FDF4"
              : isDark
              ? "rgba(42, 14, 18, 0.9)"
              : "#FEF2F2",
            borderColor: lit ? "#10B981" : "#EF4444",
            boxShadow: lit
              ? isDark
                ? "0 20px 50px -16px rgba(16,185,129,0.45), 5px 5px 0 #10B981"
                : "0 20px 50px -18px rgba(16,185,129,0.35), 5px 5px 0 #10B981"
              : isDark
              ? "5px 5px 0 #DC2626"
              : "5px 5px 0 #EF4444",
            transform: lit ? "translateY(-3px) scale(1.01)" : "translateY(0)",
          }}
        >
          {/* Document Top Bar */}
          <div
            className="mb-3.5 flex items-center justify-between gap-2 border-b pb-2.5 transition-colors duration-500"
            style={{
              borderColor: lit
                ? isDark
                  ? "rgba(16,185,129,0.28)"
                  : "rgba(16,185,129,0.25)"
                : isDark
                ? "rgba(239,68,68,0.28)"
                : "rgba(239,68,68,0.22)",
            }}
          >
            <div className="flex items-center gap-2 font-mono text-xs font-bold">
              <FileText
                size={14}
                style={{ color: lit ? "#10B981" : "#EF4444" }}
              />
              <span style={{ color: isDark ? "#FFFFFF" : "#211D16" }}>
                tai-lieu.md
              </span>
            </div>

            <span
              key={lit ? "synced" : "stale"}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] font-extrabold"
              style={{
                backgroundColor: lit
                  ? isDark
                    ? "rgba(16,185,129,0.24)"
                    : "#DCFCE7"
                  : isDark
                  ? "rgba(239,68,68,0.24)"
                  : "#FEE2E2",
                color: lit
                  ? isDark
                    ? "#6EE7B7"
                    : "#047857"
                  : isDark
                  ? "#FCA5A5"
                  : "#B91C1C",
                animation: "ld-doc-morph 320ms cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              {lit ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              <span>{lit ? "Đã đồng bộ" : "Đang bị lệch"}</span>
            </span>
          </div>

          {/* 3 Morphing Document Content Lines (Red Stale -> Green Updated) */}
          <div className="space-y-2">
            {DOC_LINES.map((line, idx) => (
              <div
                key={`${lit ? "g" : "r"}-${idx}`}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors duration-500"
                style={{
                  backgroundColor: lit
                    ? isDark
                      ? "rgba(16,185,129,0.12)"
                      : "#FFFFFF"
                    : isDark
                    ? "rgba(239,68,68,0.12)"
                    : "#FFFFFF",
                  borderColor: lit
                    ? isDark
                      ? "rgba(16,185,129,0.3)"
                      : "#A7F3D0"
                    : isDark
                    ? "rgba(239,68,68,0.3)"
                    : "#FECACA",
                  color: lit
                    ? isDark
                      ? "#D1FAE5"
                      : "#065F46"
                    : isDark
                    ? "#FECACA"
                    : "#991B1B",
                  animation: `ld-doc-morph 340ms cubic-bezier(0.22,1,0.36,1) ${
                    idx * 70
                  }ms both`,
                }}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{
                    backgroundColor: lit ? "#10B981" : "#EF4444",
                  }}
                />
                <span className={lit ? "" : "line-through decoration-red-400/70"}>
                  {lit ? line.fresh : line.stale}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
