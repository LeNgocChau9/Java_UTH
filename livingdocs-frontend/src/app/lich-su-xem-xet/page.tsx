"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CheckCircle, XCircle, Clock, GitBranch, Eye, Search, RefreshCw, AlertCircle } from "lucide-react";
import { reviewService, type ReviewHistoryItem } from "@/services/reviewService";

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  approved: { label: "Đã duyệt", icon: <CheckCircle size={12} />, bg: "#ecfdf5", color: "#059669" },
  rejected: { label: "Từ chối", icon: <XCircle size={12} />, bg: "#fef2f2", color: "#b91c1c" },
  returned: { label: "Trả về sửa", icon: <Clock size={12} />, bg: "#fffbeb", color: "#b45309" },
};

function formatReviewedAt(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function LichSuXemXetPage() {
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "approved" | "rejected" | "returned">("all");
  const [search, setSearch] = useState("");

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reviewService.getReviewHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Lỗi khi tải lịch sử xem xét:", err);
      setError("Không thể tải lịch sử xem xét từ máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const shown = history.filter((h) => {
    const matchSearch =
      (h.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.repo || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.reviewer || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || h.action === filter;
    return matchSearch && matchFilter;
  });

  return (
    <AppShell>
      <div className="ld-page-header flex items-center justify-between">
        <div>
          <h1 className="ld-page-title">Lịch sử xem xét</h1>
          <p className="ld-page-subtitle">Các tài liệu đã được rà soát và phê duyệt thực tế trong hệ thống</p>
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-emerald-700 transition shadow-sm disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
          <input
            className="ld-input"
            style={{ paddingLeft: 32 }}
            placeholder="Tìm theo tên tài liệu, repo, người duyệt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(["all", "approved", "rejected", "returned"] as const).map((f) => {
          const meta = f !== "all" ? ACTION_META[f] : null;
          const count = f === "all" ? history.length : history.filter((h) => h.action === f).length;
          return (
            <button
              key={f}
              type="button"
              className="ld-btn"
              style={{
                fontSize: 13,
                ...(filter === f
                  ? { background: "#ecfdf5", color: "#047857", border: "1px solid #059669" }
                  : { background: "#e2e8f0", color: "#475569", border: "1px solid #cbd5e1" }),
              }}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Tất cả" : meta?.label}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="ld-table">
          <thead>
            <tr>
              <th style={{ minWidth: 240 }}>Tài liệu</th>
              <th style={{ minWidth: 140 }}>Repository</th>
              <th>Người xem xét</th>
              <th>Kết quả</th>
              <th style={{ minWidth: 140 }}>Thời gian</th>
              <th>Ghi chú</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#475569", padding: "40px 0" }}>
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    Đang tải dữ liệu thực tế từ hệ thống...
                  </div>
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#475569", padding: "32px 0" }}>
                  Chưa có bản ghi xem xét nào phù hợp.
                </td>
              </tr>
            ) : (
              shown.map((h) => {
                const meta = ACTION_META[h.action] || ACTION_META.approved;
                return (
                  <tr key={h.id}>
                    <td>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>{h.title}</p>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
                        <GitBranch size={11} /> {h.repo}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#475569" }}>{h.reviewer}</span>
                    </td>
                    <td>
                      <span className="ld-badge" style={{ background: meta.bg, color: meta.color, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{formatReviewedAt(h.reviewedAt)}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#475569" }}>
                        {h.note || <em style={{ color: "#64748b" }}>—</em>}
                      </span>
                    </td>
                    <td>
                      <a href={`/kho-luu-tru/${h.docId || h.id}`} className="ld-btn ld-btn-ghost ld-btn-sm" title="Xem tài liệu">
                        <Eye size={13} />
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
