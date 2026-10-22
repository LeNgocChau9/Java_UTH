"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  AlertTriangle,
  GitPullRequest,
  FileText,
  Clock,
  ChevronRight,
  RefreshCw,
  Zap,
} from "lucide-react";

const ALERTS = [
  {
    id: 1,
    docTitle: "AuthService API Reference",
    repo: "livingdocs-backend",
    pr: { number: 142, title: "Refactor AuthService — extract token logic" },
    daysStale: 3,
    affectedFiles: ["AuthService.java", "JwtTokenProvider.java"],
    severity: "high",
    aiSuggestion: "Phần mô tả method generateToken() đã lỗi thời. AI đề xuất cập nhật tham số và ví dụ response.",
  },
  {
    id: 2,
    docTitle: "Database Schema Guide",
    repo: "livingdocs-backend",
    pr: { number: 139, title: "Add pgvector extension & embeddings table" },
    daysStale: 7,
    affectedFiles: ["V3__add_embeddings.sql", "schema.md"],
    severity: "high",
    aiSuggestion: "Bảng document_embeddings chưa được ghi nhận. Cần thêm ERD và mô tả cột.",
  },
  {
    id: 3,
    docTitle: "README — Payment Service",
    repo: "payment-service",
    pr: null,
    daysStale: 14,
    affectedFiles: ["PaymentController.java", "RefundService.java"],
    severity: "critical",
    aiSuggestion: "README chưa đề cập đến luồng refund mới được thêm 2 tuần trước.",
  },
  {
    id: 4,
    docTitle: "Frontend Architecture",
    repo: "livingdocs-web",
    pr: { number: 61, title: "Migrate to App Router (Next.js 15)" },
    daysStale: 5,
    affectedFiles: ["src/app/layout.tsx", "CLAUDE.md"],
    severity: "medium",
    aiSuggestion: "Tài liệu vẫn mô tả Pages Router. Cần cập nhật sang App Router.",
  },
];

const SEV_META: Record<string, { label: string; bg: string; color: string }> = {
  critical: { label: "Nghiêm trọng", bg: "#fef2f2", color: "#b91c1c" },
  high:     { label: "Cao",          bg: "#fffbeb", color: "#b45309" },
  medium:   { label: "Trung bình",   bg: "#ecfdf5", color: "#047857" },
};

function AlertCard({ alert, onDismiss }: { alert: (typeof ALERTS)[0]; onDismiss: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SEV_META[alert.severity];

  return (
    <div
      className="ld-card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderLeft: `3px solid ${meta.color}`,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <AlertTriangle size={14} style={{ color: meta.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>
              {alert.docTitle}
            </p>
            <span
              className="ld-badge"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
            <span className="ld-badge ld-badge-gray">
              {alert.daysStale} ngày
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
            {alert.repo}
            {alert.pr && (
              <span style={{ color: "#047857", marginLeft: 6 }}>
                ← PR #{alert.pr.number}: {alert.pr.title}
              </span>
            )}
          </p>
        </div>
        <ChevronRight
          size={14}
          style={{
            color: "#475569",
            flexShrink: 0,
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 150ms",
          }}
        />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 14px" }}>
          {/* Affected files */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 0 }}>
            File bị ảnh hưởng
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {alert.affectedFiles.map((f) => (
              <span
                key={f}
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  background: "#e2e8f0",
                  color: "#0f172a",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {f}
              </span>
            ))}
          </div>

          {/* AI suggestion */}
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 12,
              display: "flex",
              gap: 8,
            }}
          >
            <Zap size={13} style={{ color: "#047857", marginTop: 1, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#047857", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Đề xuất AI
              </p>
              <p style={{ fontSize: 13, color: "#0f172a", margin: 0, lineHeight: 1.5 }}>
                {alert.aiSuggestion}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`/kho-luu-tru/${alert.id}`} className="ld-btn ld-btn-primary ld-btn-sm">
              Xem tài liệu
            </a>
            <button type="button" className="ld-btn ld-btn-secondary ld-btn-sm" style={{ gap: 5 }}>
              <RefreshCw size={11} />
              Sinh lại với AI
            </button>
            <button
              type="button"
              className="ld-btn ld-btn-ghost ld-btn-sm"
              onClick={() => onDismiss(alert.id)}
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CanhBaoSaiLechPage() {
  const [alerts, setAlerts] = useState(ALERTS);
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium">("all");

  const dismiss = (id: number) =>
    setAlerts((prev) => prev.filter((a) => a.id !== id));

  const shown = alerts.filter(
    (a) => filter === "all" || a.severity === filter
  );

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Cảnh báo sai lệch</h1>
          <p className="ld-page-subtitle">
            Tài liệu bị ảnh hưởng bởi thay đổi code nhưng chưa được cập nhật
          </p>
        </div>
        <button type="button" className="ld-btn ld-btn-secondary" style={{ gap: 6 }}>
          <RefreshCw size={13} />
          Quét lại
        </button>
      </div>

      {/* Summary badges */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "critical", "high", "medium"] as const).map((s) => {
          const count = s === "all" ? alerts.length : alerts.filter((a) => a.severity === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className="ld-badge"
              style={{
                cursor: "pointer",
                border: `1px solid ${filter === s ? (s === "all" ? "#475569" : SEV_META[s].color) : "#e2e8f0"}`,
                ...(s === "all"
                  ? { background: "#e2e8f0", color: "#0f172a" }
                  : { background: SEV_META[s].bg, color: SEV_META[s].color }),
              }}
            >
              {count} {s === "all" ? "Tất cả" : SEV_META[s].label}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.length === 0 ? (
          <div
            className="ld-card"
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "#059669",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <GitPullRequest size={24} />
            <p style={{ margin: 0, fontSize: 14 }}>Không có cảnh báo nào. Tài liệu đang đồng bộ!</p>
          </div>
        ) : (
          shown.map((a) => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)
        )}
      </div>
    </AppShell>
  );
}
