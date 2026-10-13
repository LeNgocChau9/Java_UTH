"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Search,
  Filter,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  GitBranch,
  Tag,
  MoreHorizontal,
} from "lucide-react";

// ─── Mock data ───────────────────────────────────────────
const DOCS = [
  { id: 1, title: "AuthService API Reference", repo: "livingdocs-backend", branch: "main", tags: ["api", "auth"], status: "published", updatedAt: "2 giờ trước", version: "v3.2", coverage: 91 },
  { id: 2, title: "WebhookHandler Module Guide", repo: "livingdocs-backend", branch: "main", tags: ["webhook", "module"], status: "draft", updatedAt: "5 giờ trước", version: "v1.0", coverage: 60 },
  { id: 3, title: "Payment Gateway Integration", repo: "payment-service", branch: "feature/refund", tags: ["payment", "integration"], status: "review", updatedAt: "1 ngày trước", version: "v2.1", coverage: 78 },
  { id: 4, title: "README — API Gateway", repo: "api-gateway", branch: "main", tags: ["readme", "gateway"], status: "published", updatedAt: "2 ngày trước", version: "v4.0", coverage: 95 },
  { id: 5, title: "Notification Service Docs", repo: "notification-svc", branch: "main", tags: ["notification"], status: "diverged", updatedAt: "5 ngày trước", version: "v1.3", coverage: 40 },
  { id: 6, title: "CI/CD Pipeline Documentation", repo: "devops", branch: "main", tags: ["ci", "devops"], status: "published", updatedAt: "1 tuần trước", version: "v2.0", coverage: 85 },
  { id: 7, title: "Database Schema Guide", repo: "livingdocs-backend", branch: "main", tags: ["db", "schema"], status: "review", updatedAt: "1 tuần trước", version: "v1.5", coverage: 70 },
  { id: 8, title: "Frontend Architecture", repo: "livingdocs-web", branch: "main", tags: ["frontend", "architecture"], status: "draft", updatedAt: "2 tuần trước", version: "v0.9", coverage: 55 },
];

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  published: { label: "Published", bg: "#ecfdf5", color: "#059669" },
  draft:     { label: "Nháp",      bg: "#e2e8f0", color: "#475569" },
  review:    { label: "Chờ duyệt", bg: "#fffbeb", color: "#b45309" },
  diverged:  { label: "Sai lệch",  bg: "#fef2f2", color: "#b91c1c" },
};

const REPOS = ["Tất cả", ...Array.from(new Set(DOCS.map((d) => d.repo)))];
const STATUSES = ["Tất cả", "published", "draft", "review", "diverged"];

function DocRow({ doc }: { doc: (typeof DOCS)[0] }) {
  const meta = STATUS_META[doc.status];
  return (
    <tr>
      <td>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <FileText size={14} style={{ color: "#475569", marginTop: 2, flexShrink: 0 }} />
          <div>
            <a
              href={`/kho-luu-tru/${doc.id}`}
              style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", textDecoration: "none" }}
              className="hover:text-[#047857] transition-colors"
            >
              {doc.title}
            </a>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {doc.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 11,
                    color: "#475569",
                    background: "#e2e8f0",
                    padding: "1px 6px",
                    borderRadius: 4,
                  }}
                >
                  <Tag size={9} />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <GitBranch size={12} style={{ color: "#475569" }} />
          <span style={{ fontSize: 12, color: "#475569" }}>{doc.repo}</span>
        </div>
        <span style={{ fontSize: 11, color: "#64748b" }}>{doc.branch}</span>
      </td>
      <td>
        <span
          className="ld-badge"
          style={{ background: meta.bg, color: meta.color }}
        >
          {meta.label}
        </span>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 60,
              height: 4,
              background: "#e2e8f0",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${doc.coverage}%`,
                background:
                  doc.coverage >= 70 ? "#059669" : doc.coverage >= 50 ? "#b45309" : "#b91c1c",
                borderRadius: 2,
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: "#475569" }}>{doc.coverage}%</span>
        </div>
      </td>
      <td>
        <span style={{ fontSize: 12, color: "#64748b" }}>{doc.updatedAt}</span>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href={`/kho-luu-tru/${doc.id}`}
            className="ld-btn ld-btn-ghost ld-btn-sm"
            style={{ gap: 4, fontSize: 12 }}
          >
            Xem <ChevronRight size={11} />
          </a>
          <button type="button" className="ld-btn ld-btn-ghost ld-btn-sm" style={{ padding: "3px 6px" }}>
            <MoreHorizontal size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function KhoLuuTruPage() {
  const [search, setSearch] = useState("");
  const [repo, setRepo] = useState("Tất cả");
  const [status, setStatus] = useState("Tất cả");

  const filtered = DOCS.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.repo.toLowerCase().includes(search.toLowerCase());
    const matchRepo = repo === "Tất cả" || d.repo === repo;
    const matchStatus = status === "Tất cả" || d.status === status;
    return matchSearch && matchRepo && matchStatus;
  });

  return (
    <AppShell>
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">Kho lưu trữ tài liệu</h1>
          <p className="ld-page-subtitle">
            {DOCS.length} tài liệu trên {REPOS.length - 1} repository
          </p>
        </div>
        <a href="/yeu-cau-sinh-tai-lieu" className="ld-btn ld-btn-primary">
          + Yêu cầu sinh tài liệu
        </a>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#475569",
              pointerEvents: "none",
            }}
          />
          <input
            className="ld-input"
            style={{ paddingLeft: 32 }}
            placeholder="Tìm tài liệu, repo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} style={{ color: "#475569" }} />
          <select
            className="ld-select"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          >
            {REPOS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select
            className="ld-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "Tất cả" ? "Tất cả trạng thái" : STATUS_META[s]?.label || s}
              </option>
            ))}
          </select>
        </div>

        {/* Status summary */}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
          {Object.entries(STATUS_META).map(([k, v]) => {
            const count = DOCS.filter((d) => d.status === k).length;
            return (
              <span
                key={k}
                className="ld-badge"
                style={{ background: v.bg, color: v.color, cursor: "pointer" }}
                onClick={() => setStatus(status === k ? "Tất cả" : k)}
              >
                {count} {v.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="ld-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="ld-table">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Tài liệu</th>
                <th style={{ minWidth: 140 }}>Repository</th>
                <th style={{ minWidth: 110 }}>Trạng thái</th>
                <th style={{ minWidth: 120 }}>Độ phủ</th>
                <th style={{ minWidth: 110 }}>Cập nhật</th>
                <th style={{ minWidth: 100 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((d) => <DocRow key={d.id} doc={d} />)
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#475569", padding: "32px 0" }}>
                    Không tìm thấy tài liệu nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontSize: 12, color: "#475569" }}>
            Hiển thị {filtered.length} / {DOCS.length} tài liệu
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" className="ld-btn ld-btn-secondary ld-btn-sm" disabled>
              ← Trước
            </button>
            <button type="button" className="ld-btn ld-btn-secondary ld-btn-sm">
              Tiếp →
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
