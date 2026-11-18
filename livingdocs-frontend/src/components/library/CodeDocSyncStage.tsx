"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileCode2,
  FileText,
  GitCommitHorizontal,
  Radar,
} from "lucide-react";

export interface CodeDocSyncStageProps {
  theme?: "light" | "dark";
}

interface SyncScenario {
  id: string;
  file: string;
  docFile: string;
  beforeCode: string[];
  removedLine: string;
  addedLine: string;
  afterCode: string[];
  detectedChange: string;
  docUpdateLine: string;
}

const SCENARIOS: SyncScenario[] = [
  {
    id: "sample-1",
    file: "Tệp mã 01",
    docFile: "tài liệu",
    beforeCode: [
      "class DemoModule {",
      "  // Hàm xử lý mẫu",
    ],
    removedLine: "  handle(input) {",
    addedLine: "  handle(input, options) {",
    afterCode: [
      "    return runTask(input, options);",
      "  }",
      "}",
    ],
    detectedChange: "Phát hiện thêm tham số mới trong hàm handle()",
    docUpdateLine: "Đã tự động cập nhật mô tả tham số mới vào tài liệu.",
  },
  {
    id: "sample-2",
    file: "Tệp mã 02",
    docFile: "tài liệu",
    beforeCode: [
      "function buildResult(",
      "  data,",
    ],
    removedLine: "  format",
    addedLine: "  format, limit = 20",
    afterCode: [
      ") {",
      "  return createOutput(data, format, limit);",
      "}",
    ],
    detectedChange: "Phát hiện bổ sung giá trị mặc định trong buildResult()",
    docUpdateLine: "Đã tự động cập nhật bảng tham số và ví dụ vào tài liệu.",
  },
  {
    id: "sample-3",
    file: "Tệp mã 03",
    docFile: "tài liệu",
    beforeCode: [
      "def sync_item(item_id, mode='auto'):",
      "    # Luồng xử lý mẫu",
    ],
    removedLine: "    return save_draft(item_id)",
    addedLine: "    return save_draft(item_id, mode=mode)",
    afterCode: [
      "",
      "def notify_change(item_id):",
      "    return emit_update(item_id)",
    ],
    detectedChange: "Phát hiện thay đổi tham số gọi hàm trong sync_item()",
    docUpdateLine: "Đã tự động đồng bộ nội dung thay đổi vào tài liệu.",
  },
];

const SYNC_STEPS = [
  {
    icon: GitCommitHorizontal,
    accent: "#2563EB",
    softLight: "#EFF6FF",
    softDark: "rgba(37,99,235,0.18)",
    title: "Bắt nhịp thay đổi mã nguồn",
    desc: "Nhận diện ngay dòng code vừa thêm, đổi tham số hoặc thay đổi hành vi trong mỗi lần cập nhật.",
  },
  {
    icon: Radar,
    accent: "#D97706",
    softLight: "#FEF3C7",
    softDark: "rgba(217,119,6,0.2)",
    title: "Quét đối chiếu với tài liệu hiện tại",
    desc: "Tự động quét và khoanh vùng chính xác đoạn nội dung tài liệu đang bị lệch so với mã nguồn mới.",
  },
  {
    icon: FileText,
    accent: "#059669",
    softLight: "#ECFDF5",
    softDark: "rgba(5,150,105,0.2)",
    title: "Cập nhật chuẩn xác từng đoạn tài liệu",
    desc: "Chỉ viết lại đúng phần bị ảnh hưởng và giữ nguyên toàn bộ các mục đã phê duyệt trước đó.",
  },
];

export default function CodeDocSyncStage({
  theme = "light",
}: CodeDocSyncStageProps) {
  const isDark = theme === "dark";
  const [scenarioIdx, setScenarioIdx] = useState(0);
  // 0 = code changed, 1 = laser scanning, 2 = doc synced
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  const scenario = SCENARIOS[scenarioIdx];

  useEffect(() => {
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 1300);
    const t2 = setTimeout(() => setPhase(2), 2900);
    const t3 = setTimeout(
      () => setScenarioIdx((prev) => (prev + 1) % SCENARIOS.length),
      5000
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [scenarioIdx]);

  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes ld-code-scan {
            0% { transform: translateY(-10px); opacity: 0; }
            12% { opacity: 1; }
            88% { opacity: 1; }
            100% { transform: translateY(235px); opacity: 0; }
          }
          @keyframes ld-diff-pop {
            0% {
              opacity: 0;
              transform: translateX(-12px) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translateX(0px) scale(1);
            }
          }
          @keyframes ld-sync-toast {
            0% {
              opacity: 0;
              transform: translateY(10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0px);
            }
          }
        `,
        }}
      />

      {/* Left 7 Columns: Live Mutating Code + Laser Scanner Stage */}
      <div className="lg:col-span-7">
        <div
          className="relative overflow-hidden rounded-[30px] border-2 p-5 transition-colors duration-300 sm:p-6"
          style={{
            backgroundColor: "var(--ld-surface)",
            borderColor: "var(--ld-border)",
            boxShadow: "7px 7px 0 var(--ld-shadow)",
          }}
        >
          {/* File Tabs Header */}
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3.5"
            style={{
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(33,29,22,0.1)",
            }}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {SCENARIOS.map((item, idx) => {
                const active = idx === scenarioIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setScenarioIdx(idx)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold transition-all duration-200"
                    style={{
                      backgroundColor: active
                        ? isDark
                          ? "#FDE68A"
                          : "#211D16"
                        : "var(--ld-pill-bg)",
                      borderColor: active
                        ? isDark
                          ? "#FDE68A"
                          : "#211D16"
                        : "transparent",
                      color: active
                        ? isDark
                          ? "#111113"
                          : "#FFFCF5"
                        : "var(--ld-muted)",
                    }}
                  >
                    <FileCode2 size={12} />
                    <span>{item.file}</span>
                  </button>
                );
              })}
            </div>

            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-bold"
              style={{
                backgroundColor:
                  phase === 1
                    ? isDark
                      ? "rgba(253,230,138,0.16)"
                      : "#FEF3C7"
                    : phase === 2
                    ? isDark
                      ? "rgba(16,185,129,0.16)"
                      : "#DCFCE7"
                    : isDark
                    ? "rgba(59,130,246,0.16)"
                    : "#EFF6FF",
                borderColor:
                  phase === 1
                    ? "#D97706"
                    : phase === 2
                    ? "#059669"
                    : "#2563EB",
                color:
                  phase === 1
                    ? isDark
                      ? "#FDE68A"
                      : "#92400E"
                    : phase === 2
                    ? isDark
                      ? "#34D399"
                      : "#065F46"
                    : isDark
                    ? "#93C5FD"
                    : "#1D4ED8",
              }}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  phase === 1 ? "animate-ping" : "animate-pulse"
                }`}
                style={{
                  backgroundColor:
                    phase === 1
                      ? "#D97706"
                      : phase === 2
                      ? "#10B981"
                      : "#3B82F6",
                }}
              />
              <span>
                {phase === 0
                  ? "Code thay đổi"
                  : phase === 1
                  ? "Đang quét lệch pha..."
                  : `Đã đồng bộ ${scenario.docFile}`}
              </span>
            </span>
          </div>

          {/* Code Block with Active Laser Scan Overlay */}
          <div
            className="relative overflow-hidden rounded-2xl border p-4 font-mono text-[12px] leading-6 sm:text-[12.5px]"
            style={{
              backgroundColor: isDark ? "#0D0E12" : "#FAF7F2",
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(33,29,22,0.12)",
            }}
          >
            {/* Scanning Laser Bar during Phase 1 */}
            {phase === 1 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(245,158,11,0.22) 55%, rgba(245,158,11,0.75) 95%, transparent 100%)",
                  borderBottom: "2px solid #F59E0B",
                  animation: "ld-code-scan 1.5s ease-in-out infinite",
                }}
              />
            )}

            <div className="relative z-10 space-y-1">
              {scenario.beforeCode.map((line, i) => (
                <div
                  key={`pre-${scenario.id}-${i}`}
                  className="flex gap-3 px-2"
                  style={{ color: isDark ? "#A1A1AA" : "#57534E" }}
                >
                  <span className="w-5 select-none opacity-45">{i + 1}</span>
                  <span className="truncate">{line}</span>
                </div>
              ))}

              {/* Removed Old Line */}
              <div
                key={`rem-${scenario.id}`}
                className="flex gap-3 rounded-lg px-2 py-0.5 line-through"
                style={{
                  backgroundColor: isDark
                    ? "rgba(239,68,68,0.14)"
                    : "rgba(239,68,68,0.1)",
                  color: isDark ? "#FCA5A5" : "#B91C1C",
                  animation: "ld-diff-pop 320ms ease-out both",
                }}
              >
                <span className="w-5 select-none font-bold">-</span>
                <span className="truncate">{scenario.removedLine}</span>
              </div>

              {/* Newly Added / Mutated Line */}
              <div
                key={`add-${scenario.id}`}
                className="flex gap-3 rounded-lg border px-2 py-0.5 font-bold"
                style={{
                  backgroundColor: isDark
                    ? "rgba(16,185,129,0.16)"
                    : "#DCFCE7",
                  borderColor:
                    phase === 1
                      ? "#F59E0B"
                      : isDark
                      ? "rgba(16,185,129,0.4)"
                      : "#34D399",
                  color: isDark ? "#6EE7B7" : "#065F46",
                  animation:
                    "ld-diff-pop 420ms cubic-bezier(0.22,1,0.36,1) 180ms both",
                }}
              >
                <span className="w-5 select-none font-black">+</span>
                <span className="truncate">{scenario.addedLine}</span>
              </div>

              {scenario.afterCode.map((line, i) => (
                <div
                  key={`post-${scenario.id}-${i}`}
                  className="flex gap-3 px-2"
                  style={{ color: isDark ? "#A1A1AA" : "#57534E" }}
                >
                  <span className="w-5 select-none opacity-45">
                    {scenario.beforeCode.length + i + 3}
                  </span>
                  <span className="truncate">{line || "\u00A0"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Sync Result Strip right underneath the Code */}
          <div
            key={`status-${scenario.id}-${phase}`}
            className="mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold"
            style={{
              backgroundColor:
                phase === 2
                  ? isDark
                    ? "rgba(16,185,129,0.12)"
                    : "#ECFDF5"
                  : isDark
                  ? "rgba(253,230,138,0.08)"
                  : "#FFFBEB",
              borderColor:
                phase === 2
                  ? isDark
                    ? "rgba(16,185,129,0.3)"
                    : "#A7F3D0"
                  : isDark
                  ? "rgba(253,230,138,0.22)"
                  : "#FDE68A",
              color: isDark ? "#F4F4F5" : "#211D16",
              animation: "ld-sync-toast 320ms cubic-bezier(0.22,1,0.36,1) both",
            }}
          >
            {phase === 2 ? (
              <CheckCircle2
                size={16}
                className="flex-shrink-0 text-emerald-500"
              />
            ) : (
              <Radar
                size={16}
                className={`flex-shrink-0 text-amber-500 ${
                  phase === 1 ? "animate-spin" : ""
                }`}
              />
            )}
            <span className="leading-relaxed">
              {phase === 2 ? scenario.docUpdateLine : scenario.detectedChange}
            </span>
          </div>
        </div>
      </div>

      {/* Right 5 Columns: 3 Live Step Cards Synced with Code -> Scan -> Doc */}
      <div className="space-y-4 lg:col-span-5">
        {SYNC_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === phase;
          return (
            <div
              key={step.title}
              onClick={() => setPhase(idx as 0 | 1 | 2)}
              className={`ym-card group cursor-pointer rounded-[22px] p-5 transition-all duration-300 ${
                isActive ? "-translate-x-1 scale-[1.01]" : "opacity-80 hover:opacity-100"
              }`}
              style={
                isActive
                  ? {
                      borderColor: step.accent,
                      boxShadow: `6px 6px 0 ${step.accent}`,
                    }
                  : undefined
              }
            >
              <div className="flex items-start gap-3.5">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-[#211D16] shadow-[2px_2px_0_#211D16] transition-transform duration-300 group-hover:-rotate-6"
                  style={{
                    backgroundColor: isActive
                      ? step.accent
                      : isDark
                      ? step.softDark
                      : step.softLight,
                    color: isActive ? "#FFFFFF" : step.accent,
                  }}
                >
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <h3
                    className="text-lg font-black tracking-tight"
                    style={{ color: "var(--ld-ink)" }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="mt-1.5 text-[13.5px] leading-relaxed"
                    style={{ color: "var(--ld-muted)" }}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
