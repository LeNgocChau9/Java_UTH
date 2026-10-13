"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CheckCircle, XCircle, Clock, FileText, GitBranch, Eye, Search, ChevronDown } from "lucide-react";

const HISTORY = [
  { id: 101, title: "AuthService API Reference v3.2", repo: "livingdocs-backend", reviewer: "staff01", reviewedAt: "Hôm nay, 09:12", action: "approved", note: "Nội dung rõ ràng, đầy đủ ví dụ." },
  { id: 102, title: "Frontend Architecture v0.8", repo: "livingdocs-web", reviewer: "staff01", reviewedAt: "Hôm nay, 08:30", action: "rejected", note: "Thiếu phần mô tả routing. Cần bổ sung." },
  { id: 103, title: "Payment Gateway Integration v2.0", repo: "payment-service", reviewer: "staff02", reviewedAt: "Hôm qua, 16:45", action: "approved", note: "" },
  { id: 104, title: "Notification Service Docs v1.1", repo: "notification-svc", reviewer: "staff01", reviewedAt: "Hôm qua, 14:20", action: "approved", note: "Ổn, đã thêm ghi chú về rate limit." },
  { id: 105, title: "CI/CD Pipeline v1.9", repo: "devops", reviewer: "staff02", reviewedAt: "2 ngày trước", action: "rejected", note: "Cần thêm diagram và bước rollback." },
  { id: 106, title: "Database Schema v2.5", repo: "livingdocs-backend", reviewer: "staff01", reviewedAt: "3 ngày trước", action: "approved", note: "" },
];

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  approved: { label: "Đã duyệt",  icon: <CheckCircle size={12} />, bg: "#ecfdf5", color: "#059669" },
  rejected: { label: "Từ chối",   icon: <XCircle size={12} />,     bg: "#fef2f2", color: "#b91c1c" },
};

export default function LichSuXemXetPage() {
  const [filter, setFilter] = useState<"all" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");

  const shown = HISTORY.filter((h) => {
    const matchSearch = h.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || h.action === filter;
    return matchSearch && matchFilter;
  });

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Lịch sử xem xét</h1>
          <p className="ld-page-subtitle">Các tài liệu đã được xem xét bởi Staff</p>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
          <input
            className="ld-input"
            style={{ paddingLeft: 32 }}
            placeholder="Tìm tài liệu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(["all", "approved", "rejected"] as const).map((f) => (
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
            {f === "all" ? "Tất cả" : ACTION_META[f].label}
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
              {f === "all" ? HISTORY.length : HISTORY.filter((h) => h.action === f).length}
            </span>
          </button>
        ))}
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
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#475569", padding: "32px 0" }}>
                  Không tìm thấy kết quả.
                </td>
              </tr>
            ) : (
              shown.map((h) => {
                const meta = ACTION_META[h.action];
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
                      <span style={{ fontSize: 12, color: "#64748b" }}>{h.reviewedAt}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#475569" }}>
                        {h.note || <em style={{ color: "#64748b" }}>—</em>}
                      </span>
                    </td>
                    <td>
                      <a href={`/kho-luu-tru/${h.id}`} className="ld-btn ld-btn-ghost ld-btn-sm">
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
