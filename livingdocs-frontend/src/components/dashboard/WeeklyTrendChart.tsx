"use client";

import type { DashboardTrendItem } from "@/services/dashboardService";

function barWidth(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

export function WeeklyTrendChart({ items }: { items: DashboardTrendItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Chưa có số liệu tuần trong cơ sở dữ liệu.
      </p>
    );
  }

  const maxCount = Math.max(
    1,
    ...items.flatMap((item) => [item.createdDocs, item.approvedDocs, item.driftAlerts])
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> Tài liệu tạo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Đã duyệt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Cảnh báo sai lệch
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> Độ bao phủ AST
        </span>
      </div>
      {items.map((item) => (
        <div key={`${item.period}-${item.label}`} className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr]">
          <div>
            <p className="text-xs font-bold text-slate-800">{item.label}</p>
            <p className="text-[11px] text-slate-500">{item.period}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-sky-500" style={{ width: barWidth(item.createdDocs, maxCount) }} />
              </div>
              <span className="w-8 text-right text-[11px] font-semibold text-slate-700">{item.createdDocs}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: barWidth(item.approvedDocs, maxCount) }} />
              </div>
              <span className="w-8 text-right text-[11px] font-semibold text-slate-700">{item.approvedDocs}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-amber-500" style={{ width: barWidth(item.driftAlerts, maxCount) }} />
              </div>
              <span className="w-8 text-right text-[11px] font-semibold text-slate-700">{item.driftAlerts}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.min(100, Math.max(0, item.coverageRate))}%` }} />
              </div>
              <span className="w-8 text-right text-[11px] font-semibold text-slate-700">{item.coverageRate}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
