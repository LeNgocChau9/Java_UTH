"use client";

import React, { useState, useEffect, useRef } from "react";

export interface PresenceCardsProps {
  theme?: "dark" | "light";
  className?: string;
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  waypoints: Array<{ x: number; y: number }>;
}

// Waypoints focused on the wide heatmap & right edge so cursors never cover the GitHub logo or title
const COLLABORATORS: Collaborator[] = [
  {
    id: "user-1",
    name: "User 1",
    color: "#3B82F6",
    waypoints: [
      { x: 18, y: 58 },
      { x: 46, y: 74 },
      { x: 32, y: 84 },
      { x: 22, y: 66 },
    ],
  },
  {
    id: "user-2",
    name: "User 2",
    color: "#F97316",
    waypoints: [
      { x: 74, y: 52 },
      { x: 84, y: 70 },
      { x: 64, y: 80 },
      { x: 78, y: 58 },
    ],
  },
  {
    id: "user-3",
    name: "User 3",
    color: "#F59E0B",
    waypoints: [
      { x: 48, y: 50 },
      { x: 68, y: 62 },
      { x: 52, y: 78 },
      { x: 38, y: 56 },
    ],
  },
  {
    id: "user-4",
    name: "User 4",
    color: "#EC4899",
    waypoints: [
      { x: 80, y: 24 },
      { x: 86, y: 44 },
      { x: 72, y: 68 },
      { x: 84, y: 30 },
    ],
  },
];

// Deterministic 5x18 wide GitHub contribution matrix (0..3)
const INITIAL_HEATMAP: number[][] = [
  [0, 1, 2, 0, 1, 3, 2, 1, 0, 2, 3, 2, 1, 0, 2, 3, 2, 1],
  [1, 2, 3, 1, 0, 2, 3, 2, 1, 1, 2, 3, 2, 1, 3, 2, 1, 3],
  [0, 1, 1, 2, 3, 1, 0, 2, 3, 2, 1, 2, 0, 2, 1, 3, 2, 2],
  [2, 3, 1, 0, 2, 3, 2, 1, 2, 3, 3, 1, 2, 3, 2, 1, 3, 2],
  [1, 0, 2, 2, 1, 1, 3, 3, 1, 2, 2, 3, 1, 1, 2, 2, 3, 1],
];

export default function PresenceCards({
  theme = "dark",
  className = "",
}: PresenceCardsProps) {
  const isDark = theme === "dark";
  const stageRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [heatmap, setHeatmap] = useState<number[][]>(INITIAL_HEATMAP);
  const [userCursor, setUserCursor] = useState<{
    x: number;
    y: number;
    active: boolean;
  }>({ x: 50, y: 50, active: false });

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % 4);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setUserCursor({ x, y, active: true });
  };

  const handleCellClick = (r: number, c: number) => {
    setHeatmap((prev) =>
      prev.map((row, rIdx) =>
        rIdx === r ? row.map((v, cIdx) => (cIdx === c ? (v + 1) % 4 : v)) : row
      )
    );
  };

  const getCellColor = (level: number) => {
    if (isDark) {
      if (level === 0) return "#24292e";
      if (level === 1) return "#0e4429";
      if (level === 2) return "#006d32";
      return "#39d353";
    }
    if (level === 0) return "#ebedf0";
    if (level === 1) return "#9be9a8";
    if (level === 2) return "#40c463";
    return "#216e39";
  };

  return (
    <div
      ref={stageRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setUserCursor((p) => ({ ...p, active: false }))}
      className={`relative w-full overflow-hidden select-none transition-colors duration-500 ${className}`}
      style={{
        borderRadius: 22,
        backgroundColor: isDark ? "#0d0d0f" : "#f4f4f5",
        padding: "22px 22px 24px",
      }}
    >
      {/* Scoped Presence Motion Keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes ppres-drift-a {
            0% { transform: translate(0px, 0px) scale(1); }
            100% { transform: translate(34px, -18px) scale(1.12); }
          }
          @keyframes ppres-drift-b {
            0% { transform: translate(0px, 0px) scale(1.06); }
            100% { transform: translate(-28px, 22px) scale(0.95); }
          }
        `,
        }}
      />

      {/* Ambient GitHub Emerald Bloom Orbs */}
      <div
        className="pointer-events-none absolute -top-12 -left-10 h-56 w-56 rounded-full"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(57,211,83,0.16) 0%, transparent 72%)"
            : "radial-gradient(circle, rgba(155,233,168,0.45) 0%, transparent 72%)",
          filter: "blur(60px)",
          animation: "ppres-drift-a 20s ease-in-out infinite alternate",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-14 -right-10 h-64 w-64 rounded-full"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(45,164,78,0.2) 0%, transparent 72%)"
            : "radial-gradient(circle, rgba(64,196,99,0.32) 0%, transparent 72%)",
          filter: "blur(72px)",
          animation: "ppres-drift-b 24s ease-in-out infinite alternate",
        }}
      />

      {/* Subtle Canvas Dot Grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)"
            : "radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          opacity: 0.55,
        }}
      />

      {/* Wide Landscape Stacked Cards (True Rectangular Aspect) */}
      <div className="relative z-10 flex w-full flex-col gap-4">
        {/* ─── CARD 1: Compact Horizontal GitHub Spec Header Bar ─── */}
        <div
          className="relative flex items-center justify-between gap-4 px-5 py-4 transition-all duration-300"
          style={{
            borderRadius: 22,
            backgroundColor: isDark ? "#1b1b1e" : "#ffffff",
            boxShadow: isDark
              ? "0 0 0 1px rgba(255,255,255,0.07), 0 1px 0 rgba(255,255,255,0.05) inset, 0 14px 30px -10px rgba(0,0,0,0.72)"
              : "0 0 0 1px rgba(0,0,0,0.06), 0 12px 26px -10px rgba(0,0,0,0.1)",
          }}
        >
          <div className="flex min-w-0 items-center gap-4">
            {/* Clean Compact GitHub Logo Box */}
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl shadow-md transition-transform duration-300 hover:scale-105"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #24292e 0%, #0d1117 100%)"
                  : "linear-gradient(135deg, #24292e 0%, #161b22 100%)",
              }}
            >
              <svg
                width="30"
                height="30"
                viewBox="0 0 16 16"
                fill="#ffffff"
                aria-hidden="true"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </div>

            {/* Clean Title & Subtitle */}
            <div className="min-w-0">
              <div
                className="truncate text-[22px] font-bold leading-tight tracking-[-0.02em]"
                style={{ color: isDark ? "#f4f4f6" : "#18181b" }}
              >
                Repository
              </div>
              <div
                className="truncate font-mono text-[13px]"
                style={{ color: isDark ? "#8f8f95" : "#71717a" }}
              >
                LeNgocChau9/Java_UTH
              </div>
            </div>
          </div>

          {/* Right Live Online Indicator */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#39d353] animate-pulse" />
            <span
              className="font-mono text-[11.5px] font-medium"
              style={{ color: isDark ? "#a1a1aa" : "#52525b" }}
            >
              4 online
            </span>
          </div>
        </div>

        {/* ─── CARD 2: Wide 18-Column GitHub Green Activity Heatmap ─── */}
        <div
          className="relative px-5 py-5 transition-all duration-300"
          style={{
            borderRadius: 22,
            backgroundColor: isDark ? "#1b1b1e" : "#ffffff",
            boxShadow: isDark
              ? "0 0 0 1px rgba(255,255,255,0.07), 0 1px 0 rgba(255,255,255,0.05) inset, 0 14px 30px -10px rgba(0,0,0,0.72)"
              : "0 0 0 1px rgba(0,0,0,0.06), 0 12px 26px -10px rgba(0,0,0,0.1)",
          }}
        >
          {/* Month Axis Header (Spans 18 Columns) */}
          <div
            className="mb-3 grid pl-7 text-[11px] font-medium"
            style={{
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              color: isDark ? "#7d7d84" : "#71717a",
            }}
          >
            <span>Thg 7</span>
            <span>Thg 8</span>
            <span>Thg 9</span>
            <span>Thg 10</span>
            <span>Thg 11</span>
          </div>

          {/* 5-Row × 18-Column Contribution Grid */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex flex-col justify-between gap-[16px] text-[10px] font-medium"
              style={{ color: isDark ? "#7d7d84" : "#71717a" }}
            >
              <span>T2</span>
              <span>T4</span>
              <span>T6</span>
            </div>

            <div
              className="grid flex-1 gap-[5px]"
              style={{
                gridTemplateColumns: "repeat(18, minmax(0, 1fr))",
              }}
            >
              {heatmap.map((row, rIdx) =>
                row.map((val, cIdx) => (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    type="button"
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    aria-label={`Ngày ${rIdx + 1}-${cIdx + 1}: mức ${val}`}
                    className="aspect-square w-full cursor-pointer rounded-[4px] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-125 active:scale-90"
                    style={{
                      backgroundColor: getCellColor(val),
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4 ANIMATED MULTIPLAYER PRESENCE CURSORS ─── */}
      {COLLABORATORS.map((collab) => {
        const pt = collab.waypoints[step % collab.waypoints.length];
        return (
          <div
            key={collab.id}
            className="pointer-events-none absolute z-20 transition-all duration-[1800ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
            }}
          >
            <svg
              width="16"
              height="18"
              viewBox="0 0 16 18"
              fill="none"
              style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}
            >
              <path
                d="M1.5 1.5L14 9L8 10.5L5.5 16L1.5 1.5Z"
                fill={collab.color}
                stroke="#ffffff"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            <div
              className="ml-3 -mt-1 inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight text-white"
              style={{
                backgroundColor: collab.color,
                boxShadow:
                  "0 1px 2px rgba(0,0,0,0.16), 0 4px 10px -2px rgba(0,0,0,0.28)",
              }}
            >
              <span>{collab.name}</span>
            </div>
          </div>
        );
      })}

      {/* Live "you" Interactive Presence Badge following real mouse */}
      {userCursor.active && (
        <div
          className="pointer-events-none absolute z-30 transition-transform duration-75"
          style={{
            left: `${userCursor.x}%`,
            top: `${userCursor.y}%`,
            transform: "translate(10px, 12px)",
          }}
        >
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow-lg"
            style={{ backgroundColor: "#2da44e" }}
          >
            you
          </span>
        </div>
      )}
    </div>
  );
}
