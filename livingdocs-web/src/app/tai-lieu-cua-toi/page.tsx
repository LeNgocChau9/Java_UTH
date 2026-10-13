"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  FileText,
  GitBranch,
  Clock,
  CheckCircle,
  AlertTriangle,
  Edit3,
  Eye,
  Trash2,
  Plus,
} from "lucide-react";

const MY_DOCS = [
  { id: 1, title: "AuthService API Reference", repo: "livingdocs-backend", branch: "main", status: "published", updatedAt: "2 giờ trước", version: "v3.2", myRole: "author" },
  { id: 2, title: "WebhookHandler Module Guide", repo: "livingdocs-backend", branch: "main", status: "draft", updatedAt: "5 giờ trước", version: "v1.0", myRole: "author" },
  { id: 3, title: "Database Schema Guide", repo: "livingdocs-backend", branch: "main", status: "review", updatedAt: "1 tuần trước", version: "v1.5", myRole: "author" },
  { id: 4, title: "CI/CD Pipeline Documentation", repo: "devops", branch: "main", status: "published", updatedAt: "1 tuần trước", version: "v2.0", myRole: "contributor" },
  { id: 5, title: "Frontend Architecture", repo: "livingdocs-web", branch: "main", status: "draft", updatedAt: "2 tuần trước", version: "v0.9", myRole: "author" },
];

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  published: { label: "Published", icon: <CheckCircle size={11} />, bg: "#ecfdf5", color: "#059669" },
  draft:     { label: "Nháp",      icon: <Edit3 size={11} />,        bg: "#e2e8f0", color: "#475569" },
  review:    { label: "Chờ duyệt", icon: <Clock size={11} />,        bg: "#fffbeb", color: "#b45309" },
  diverged:  { label: "Sai lệch",  icon: <AlertTriangle size={11} />, bg: "#fef2f2", color: "#b91c1c" },
};

const TABS = ["Tất cả", "Nháp", "Chờ duyệt", "Published"];
const TAB_MAP: Record<string, string | null> = {
  "Tất cả": null,
  "Nháp": "draft",
  "Chờ duyệt": "review",
  "Published": "published",
};

export default function TaiLieuCuaToiPage() {
  const [tab, setTab] = useState("Tất cả");

  const filtered = MY_DOCS.filter((d) => {
    const st = TAB_MAP[tab];
    return st === null || d.status === st;
  });

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Tài liệu của tôi</h1>
          <p className="ld-page-subtitle">
            {MY_DOCS.length} tài liệu bạn tạo hoặc đóng góp
          </p>
        </div>
        <a href="/yeu-cau-sinh-tai-lieu" className="ld-btn ld-btn-primary">
          <Plus size={14} />
          Yêu cầu mới
        </a>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {Object.entries(STATUS_META).map(([k, v]) => {
          const count = MY_DOCS.filter((d) => d.status === k).length;
          return (
            <div
              key={k}
              className="ld-card"
              style={{
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                border: TAB_MAP[tab] === k ? `1px solid ${v.color}` : undefined,
              }}
              onClick={() =>
                setTab(TABS.find((t) => TAB_MAP[t] === k) || "Tất cả")
              }
            >
              <span style={{ color: v.color }}>{v.icon}</span>
              <div>
                <p style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", margin: 0 }}>{count}</p>
                <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>{v.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid #e2e8f0",
          marginBottom: 16,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "#0f172a" : "#475569",
              background: "transparent",
              border: "none",
              borderBottom: tab === t ? "2px solid #059669" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 120ms",
            }}
          >
            {t}
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                color: tab === t ? "#047857" : "#64748b",
                background: tab === t ? "#ecfdf5" : "#e2e8f0",
                padding: "1px 5px",
                borderRadius: 10,
              }}
            >
              {MY_DOCS.filter((d) => {
                const st = TAB_MAP[t];
                return st === null || d.status === st;
              }).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <div className="ld-card" style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>
            Không có tài liệu nào.
          </div>
        )}
        {filtered.map((doc) => {
          const meta = STATUS_META[doc.status];
          return (
            <div
              key={doc.id}
              className="ld-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
              }}
            >
              <FileText size={16} style={{ color: "#047857", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>
                    {doc.title}
                  </p>
                  <span
                    className="ld-badge"
                    style={{
                      background: meta.bg,
                      color: meta.color,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                  {doc.myRole === "contributor" && (
                    <span className="ld-badge ld-badge-gray">Đóng góp</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
                    <GitBranch size={11} />
                    {doc.repo} / {doc.branch}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {doc.version} · {doc.updatedAt}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <a href={`/kho-luu-tru/${doc.id}`} className="ld-btn ld-btn-ghost ld-btn-sm">
                  <Eye size={13} />
                </a>
                {doc.status !== "published" && (
                  <button type="button" className="ld-btn ld-btn-ghost ld-btn-sm">
                    <Edit3 size={13} />
                  </button>
                )}
                {doc.status === "draft" && (
                  <button type="button" className="ld-btn ld-btn-ghost ld-btn-sm" style={{ color: "#b91c1c" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
