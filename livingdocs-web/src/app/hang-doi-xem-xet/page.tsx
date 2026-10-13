"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Inbox,
  Clock,
  FileText,
  GitBranch,
  Eye,
  Edit3,
  CheckCircle,
  XCircle,
  ChevronRight,
  Search,
} from "lucide-react";

const QUEUE = [
  { id: 1, title: "WebhookHandler Module Guide", repo: "livingdocs-backend", author: "dev01@company.com", submittedAt: "10 phút trước", type: "module", priority: "high", wordCount: 1240, aiScore: 87 },
  { id: 2, title: "Notification Service Docs", repo: "notification-svc", author: "dev02@company.com", submittedAt: "1 giờ trước", type: "api", priority: "normal", wordCount: 860, aiScore: 72 },
  { id: 3, title: "CI/CD Pipeline Update", repo: "devops", author: "dev03@company.com", submittedAt: "3 giờ trước", type: "changelog", priority: "low", wordCount: 340, aiScore: 91 },
  { id: 4, title: "Payment Refund Flow", repo: "payment-service", author: "dev01@company.com", submittedAt: "5 giờ trước", type: "module", priority: "high", wordCount: 2100, aiScore: 64 },
  { id: 5, title: "Database Schema v3 Guide", repo: "livingdocs-backend", author: "dev04@company.com", submittedAt: "Hôm qua", type: "architecture", priority: "normal", wordCount: 1780, aiScore: 79 },
];

const PRIORITY: Record<string, { label: string; bg: string; color: string }> = {
  high:   { label: "Ưu tiên cao", bg: "#fef2f2", color: "#b91c1c" },
  normal: { label: "Bình thường", bg: "#e2e8f0", color: "#475569" },
  low:    { label: "Thấp",        bg: "#ecfdf5", color: "#059669" },
};

const TYPE_LABEL: Record<string, string> = {
  api: "API Reference", module: "Module Guide", changelog: "Changelog", architecture: "Architecture", readme: "README",
};

function QueueItem({ item }: { item: (typeof QUEUE)[0] }) {
  const pri = PRIORITY[item.priority];
  const scoreColor =
    item.aiScore >= 80 ? "#059669" : item.aiScore >= 60 ? "#b45309" : "#b91c1c";

  return (
    <div
      className="ld-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: "#ecfdf5",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <FileText size={15} style={{ color: "#047857" }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>
            {item.title}
          </p>
          <span className="ld-badge" style={{ background: pri.bg, color: pri.color }}>
            {pri.label}
          </span>
          <span className="ld-badge ld-badge-gray">{TYPE_LABEL[item.type]}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
            <GitBranch size={11} />
            {item.repo}
          </span>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {item.author.split("@")[0]} · {item.submittedAt}
          </span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{item.wordCount.toLocaleString()} từ</span>
        </div>
      </div>

      {/* AI score */}
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: scoreColor, margin: 0 }}>
          {item.aiScore}
        </p>
        <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>AI Score</p>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <a href={`/xem-xet/${item.id}`} className="ld-btn ld-btn-primary ld-btn-sm" style={{ gap: 5 }}>
          <Eye size={12} />
          Xem xét
        </a>
      </div>
    </div>
  );
}

export default function HangDoiXemXetPage() {
  const [search, setSearch] = useState("");

  const shown = QUEUE.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.repo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Hàng đợi xem xét tài liệu</h1>
          <p className="ld-page-subtitle">
            {QUEUE.length} tài liệu chờ Staff xem xét trước khi gửi Manager
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Tổng chờ", value: QUEUE.length, color: "#047857" },
          { label: "Ưu tiên cao", value: QUEUE.filter((q) => q.priority === "high").length, color: "#b91c1c" },
          { label: "AI Score trung bình", value: Math.round(QUEUE.reduce((s, q) => s + q.aiScore, 0) / QUEUE.length), color: "#b45309" },
        ].map((s) => (
          <div key={s.label} className="ld-stat" style={{ flex: "1 1 140px" }}>
            <p className="ld-stat-label">{s.label}</p>
            <p className="ld-stat-value" style={{ fontSize: 22, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 360, marginBottom: 16 }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
        <input
          className="ld-input"
          style={{ paddingLeft: 32 }}
          placeholder="Tìm tài liệu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Queue */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.length === 0 ? (
          <div className="ld-card" style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}>
            Hàng đợi trống — không có gì để xem xét.
          </div>
        ) : (
          shown.map((q) => <QueueItem key={q.id} item={q} />)
        )}
      </div>
    </AppShell>
  );
}
